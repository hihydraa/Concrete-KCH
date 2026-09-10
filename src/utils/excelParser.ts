import * as XLSX from 'xlsx';
import { DriverSummary, PlantSettings, WeighTicket } from '../types';
import { defaultSettings } from '../data/masterSettings';
import { enrichTicket, normalizeDate, normalizePlate, normalizeThaiText } from './textNormalizer';

/**
 * Parses raw Excel files exported from the weighbridge software (e.g. 0108_0209_report.xlsx)
 * Implements column mappings and header filter described in Section 3.1
 */
export interface ParseWeighbridgeResult {
  tickets: WeighTicket[];
  sheetName: string;
  sheetNames: string[];
  totalSheetRows: number;
  parsedRows: number;
  mergedSecondLines: number;
  headerFooterRows: number;
  blankRows: number;
  skippedRows: number;
  warnings: string[];
}

/**
 * Parses raw Excel files exported from the weighbridge software (e.g. 0108_0209_report.xlsx)
 * Supports multi-sheet workbooks (Page1, Page2...), repeated headers, 2-line ticket formats,
 * and robust column mapping without dropping valid rows.
 */
export async function parseWeighbridgeExcel(
  file: File,
  settings: PlantSettings
): Promise<ParseWeighbridgeResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const warnings: string[] = [];
  const parsedSheetNames: string[] = [];
  const allTickets: WeighTicket[] = [];
  let totalSheetRows = 0;
  let totalMergedSecondLines = 0;
  let totalHeaderFooterRows = 0;
  let totalBlankRows = 0;

  // 1. Identify which sheets to parse
  // In many exports, multi-page reports are split into Page1, Page2, Page3... or Sheet1, Sheet2...
  // We inspect all sheets in the workbook.
  const candidateSheets = workbook.SheetNames.filter((name) => {
    const lower = name.toLowerCase().trim();
    // Exclude configuration sheets if present
    if (lower === 'transfer' || lower === 'truck' || lower === 'config' || lower === 'setting' || lower === 'ตั้งค่า') {
      return false;
    }
    return true;
  });

  const sheetsToParse = candidateSheets.length > 0 ? candidateSheets : workbook.SheetNames;

  for (const targetSheetName of sheetsToParse) {
    const worksheet = workbook.Sheets[targetSheetName];
    if (!worksheet) continue;

    // Convert sheet to array of rows (2D array)
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    totalSheetRows += rows.length;

    // Check if the sheet uses the Standard 0108_0209_report layout (Section 3.1)
    // In this layout, data rows have >= 25 cells (often 46+ cells),
    // and specific columns contain plate, product, weights, price, carrier code, and driver.
    let isStandardWeighbridgeLayout = false;
    for (let r = 0; r < Math.min(35, rows.length); r++) {
      const row = rows[r];
      if (row && row.length >= 25) {
        const pCandidate = String(row[27] || row[28] || '').trim();
        const plateCandidate = String(row[20] || row[21] || '').trim();
        const wCandidate = Number(row[33]) || Number(row[36]) || Number(row[39]);
        if (
          (pCandidate && (pCandidate.includes('คอนกรีต') || pCandidate.includes('หิน') || pCandidate.includes('ทราย') || pCandidate.includes('ปูน') || pCandidate.includes('ดิน'))) ||
          (plateCandidate && /\d/.test(plateCandidate)) ||
          (wCandidate > 0)
        ) {
          isStandardWeighbridgeLayout = true;
          break;
        }
      }
    }

    // Detect column mapping for both standard and generic sheets
    let colIndexMap: { [key: string]: number } = {};
    let headerRowIndex = -1;

    // Scan the first 35 rows to find header labels
    for (let r = 0; r < Math.min(35, rows.length); r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const rowStr = row.map((cell) => String(cell || '').trim().toLowerCase()).join(' ');

      let matchCount = 0;
      if (rowStr.includes('เลขที่') || rowStr.includes('ticket') || rowStr.includes('บิล') || rowStr.includes('ตั๋ว')) matchCount++;
      if (rowStr.includes('ทะเบียน') || rowStr.includes('plate') || rowStr.includes('รถ')) matchCount++;
      if (rowStr.includes('สินค้า') || rowStr.includes('product') || rowStr.includes('รายการ')) matchCount++;
      if (rowStr.includes('เข้า') || rowStr.includes('ออก') || rowStr.includes('น้ำหนัก') || rowStr.includes('weight')) matchCount++;
      if (rowStr.includes('วันที่') || rowStr.includes('date')) matchCount++;
      if (rowStr.includes('เวลา') || rowStr.includes('time')) matchCount++;
      if (rowStr.includes('ลูกค้า') || rowStr.includes('customer')) matchCount++;
      if (rowStr.includes('ผู้ขนส่ง') || rowStr.includes('carrier') || rowStr.includes('ขนส่ง')) matchCount++;

      if (matchCount >= 2) {
        headerRowIndex = r;
        row.forEach((cell, idx) => {
          const c = String(cell || '').trim().toLowerCase();
          if (!c) return;

          if ((c.includes('เลขที่') || c.includes('ticket') || c.includes('บิล') || c.includes('ตั๋ว') || c.includes('ใบชั่ง') || c.includes('หมายเลข') || c.includes('doc')) && !c.includes('ลำดับ')) {
            if (colIndexMap['ticketNo'] === undefined) colIndexMap['ticketNo'] = idx;
          } else if (
            c.includes('รหัสผู้ขนส่ง') ||
            c.includes('รหัสขนส่ง') ||
            c.includes('รหัสสาย') ||
            c.includes('รหัสพนักงานขับ') ||
            c.includes('รหัสพขร') ||
            c.includes('carriercode') ||
            c.includes('carrier_code') ||
            (c.includes('ผู้ขนส่ง') && !c.includes('ชื่อ')) ||
            (c.includes('carrier') && !c.includes('name'))
          ) {
            colIndexMap['carrierCode'] = idx;
          } else if (
            c.includes('ชื่อผู้ขนส่ง') ||
            c.includes('ชื่อพนักงานขับ') ||
            c.includes('ชื่อผู้ขับ') ||
            c.includes('ชื่อคนขับ') ||
            c.includes('พนักงานขับ') ||
            c.includes('ผู้ขับ') ||
            c.includes('พขร') ||
            (c.includes('คนขับ') && !c.includes('รหัส')) ||
            c.includes('driver') ||
            (c.includes('carrier') && c.includes('name'))
          ) {
            colIndexMap['driver'] = idx;
          } else if (c.includes('ขนส่ง') || c.includes('สาย') || c.includes('carrier')) {
            if (colIndexMap['carrierCode'] === undefined) colIndexMap['carrierCode'] = idx;
            else if (colIndexMap['driver'] === undefined) colIndexMap['driver'] = idx;
          } else if (c.includes('ทะเบียน') || c.includes('plate') || (c.includes('รถ') && !c.includes('ประเภท'))) {
            colIndexMap['plate'] = idx;
          } else if (c.includes('ลูกค้า') || c.includes('customer') || c.includes('ผู้รับ') || c.includes('โครงการ') || c.includes('สถานที่')) {
            colIndexMap['customer'] = idx;
          } else if (c.includes('รายละเอียด') || c.includes('ประเภทรายการ') || c.includes('detail')) {
            colIndexMap['detail'] = idx;
          } else if (c.includes('สินค้า') || c.includes('เกรด') || c.includes('product') || c.includes('รายการ') || c.includes('ชนิด') || c === 'คอนกรีต' || c.includes('คอนกรีต')) {
            if (colIndexMap['product'] === undefined) colIndexMap['product'] = idx;
          } else if (c.includes('นน.เข้า') || c.includes('น้ำหนักเข้า') || c.includes('ชั่งเข้า') || c.includes('gross') || (c.includes('เข้า') && c.includes('หนัก'))) {
            colIndexMap['weightIn'] = idx;
          } else if (c.includes('นน.ออก') || c.includes('น้ำหนักออก') || c.includes('ชั่งออก') || c.includes('tare') || (c.includes('ออก') && c.includes('หนัก'))) {
            colIndexMap['weightOut'] = idx;
          } else if (c.includes('นน.สุทธิ') || c.includes('น้ำหนักสุทธิ') || c.includes('ชั่งสุทธิ') || c.includes('net') || c.includes('สุทธิ')) {
            colIndexMap['weightNet'] = idx;
          } else if (c.includes('จำนวนเงิน') || c.includes('ยอดเงิน') || c.includes('ราคา') || c.includes('price') || c.includes('amount') || c.includes('รวมเงิน')) {
            colIndexMap['price'] = idx;
          } else if ((c.includes('จำนวน') && !c.includes('เงิน')) || c.includes('ปริมาณ') || c.includes('คิว') || c.includes('qty') || c.includes('volume') || c.includes('หน่วย')) {
            colIndexMap['quantity'] = idx;
          } else if (c.includes('วันที่เข้า') || c.includes('datein')) {
            colIndexMap['dateIn'] = idx;
          } else if (c.includes('วันที่ออก') || c.includes('dateout')) {
            colIndexMap['dateOut'] = idx;
          } else if (c.includes('วันที่') || c.includes('date')) {
            if (colIndexMap['dateIn'] === undefined) colIndexMap['dateIn'] = idx;
            else if (colIndexMap['dateOut'] === undefined) colIndexMap['dateOut'] = idx;
          } else if (c.includes('เวลาเข้า') || c.includes('timein')) {
            colIndexMap['timeIn'] = idx;
          } else if (c.includes('เวลาออก') || c.includes('timeout')) {
            colIndexMap['timeOut'] = idx;
          } else if (c.includes('เวลา') || c.includes('time')) {
            if (colIndexMap['timeIn'] === undefined) colIndexMap['timeIn'] = idx;
            else if (colIndexMap['timeOut'] === undefined) colIndexMap['timeOut'] = idx;
          }
        });
        break;
      }
    }

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    if (startRow > 0) {
      totalHeaderFooterRows += startRow;
    }
    let sheetParsedTickets = 0;

    // Attempt to extract default date from sheet title if present (e.g. "บิลตาชั่ง แพล้นคอนกรีต วันที่ 1 กันยายน  2569")
    let sheetDefaultDate = '';
    const scanLimit = headerRowIndex >= 0 ? headerRowIndex + 1 : Math.min(rows.length, 5);
    for (let r = 0; r < scanLimit; r++) {
      const rStr = (rows[r] || []).map((c) => String(c || '')).join(' ');
      const parsed = normalizeDate(rStr);
      if (parsed) {
        sheetDefaultDate = parsed;
        break;
      }
    }

    // Helper: is a cell completely empty
    const isEmpty = (v: any) => v === undefined || v === null || String(v).trim() === '';

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0 || row.every(isEmpty)) {
        totalBlankRows++;
        continue;
      }

      const rowStr = row.map((cell) => String(cell || '').trim()).join(' ');
      const lowerRowStr = rowStr.toLowerCase();

      // Check for summary/grand total lines, print headers, or page dividers
      if (
        lowerRowStr.includes('ยอดรวมทั้งสิ้น') ||
        lowerRowStr.includes('รวมทั้งสิ้น') ||
        lowerRowStr.includes('รวมสุทธิ') ||
        lowerRowStr.includes('รวมหน้านี้') ||
        lowerRowStr.includes('รวมเงิน') ||
        lowerRowStr.includes('รวมน้ำหนัก') ||
        lowerRowStr.includes('grand total') ||
        lowerRowStr.includes('subtotal') ||
        lowerRowStr.includes('sub total') ||
        lowerRowStr.includes('พิมพ์เมื่อ') ||
        lowerRowStr.includes('รายงานประจำ') ||
        lowerRowStr.includes('รายงานสรุป') ||
        lowerRowStr.includes('รายงานการชั่ง') ||
        lowerRowStr.includes('หน้า :') ||
        lowerRowStr.includes('page :') ||
        lowerRowStr.includes('หน้าที่') ||
        lowerRowStr.includes('เฉลี่ย')
      ) {
        totalHeaderFooterRows++;
        continue;
      }

      // If this row is a repeated header row inside a multi-page sheet, skip it
      if (
        (lowerRowStr.includes('เลขที่') || lowerRowStr.includes('ticket')) &&
        (lowerRowStr.includes('ทะเบียน') || lowerRowStr.includes('สินค้า') || lowerRowStr.includes('น้ำหนัก'))
      ) {
        totalHeaderFooterRows++;
        continue;
      }

      let rawTicketNo = '';
      let dateIn = '';
      let timeIn = '';
      let dateOut = '';
      let timeOut = '';
      let plate = '';
      let customer = '';
      let product = '';
      let weightIn = 0;
      let weightOut = 0;
      let weightNet = 0;
      let price = 0;
      let carrierCode = '';
      let explicitDriver = '';
      let explicitQuantity: number | undefined = undefined;

      if (isStandardWeighbridgeLayout && row.length >= 25) {
        // Standard 0108_0209_report column layout (Section 3.1)
        // 1. Ticket number: check col 0, or col 1 if col 0 is row sequence number
        const c0 = String(row[0] || '').trim();
        const c1 = String(row[1] || '').trim();
        if (c0 && (/^\d{5,}/.test(c0) || /^[A-Za-z0-9\-_]+$/.test(c0) || c0.includes('-'))) {
          rawTicketNo = c0;
        } else if (c1 && (/^\d{5,}/.test(c1) || c1.includes('-'))) {
          rawTicketNo = c1;
        } else {
          rawTicketNo = c0;
        }

        dateIn = (colIndexMap['dateIn'] !== undefined && row[colIndexMap['dateIn']] !== undefined && row[colIndexMap['dateIn']] !== '')
          ? row[colIndexMap['dateIn']]
          : (row[1] || row[2] || '');
        timeIn = (colIndexMap['timeIn'] !== undefined && row[colIndexMap['timeIn']] !== undefined && row[colIndexMap['timeIn']] !== '')
          ? row[colIndexMap['timeIn']]
          : (row[6] || row[7] || '');
        dateOut = (colIndexMap['dateOut'] !== undefined && row[colIndexMap['dateOut']] !== undefined && row[colIndexMap['dateOut']] !== '')
          ? row[colIndexMap['dateOut']]
          : (row[10] || row[11] || dateIn);
        timeOut = (colIndexMap['timeOut'] !== undefined && row[colIndexMap['timeOut']] !== undefined && row[colIndexMap['timeOut']] !== '')
          ? row[colIndexMap['timeOut']]
          : (row[16] || row[17] || timeIn);
        plate = row[21] || row[20] || '';
        customer = row[25] || row[24] || '';
        product = row[28] || row[27] || '';
        weightIn = Number(row[33]) || 0;
        weightOut = Number(row[36]) || 0;
        weightNet = Number(row[39]) || 0;
        price = Number(row[42] || row[41]) || 0;

        // Carrier code: Priority 1 is detected header column
        if (colIndexMap['carrierCode'] !== undefined && row[colIndexMap['carrierCode']] !== undefined) {
          carrierCode = String(row[colIndexMap['carrierCode']] || '').trim();
        } else {
          carrierCode = String(row[45] || '').trim();
        }

        // Driver name: Priority 1 is detected header column
        if (colIndexMap['driver'] !== undefined && row[colIndexMap['driver']] !== undefined) {
          explicitDriver = String(row[colIndexMap['driver']] || '').trim();
        } else {
          for (let c = 46; c < row.length; c++) {
            const val = String(row[c] || '').trim();
            if (val && !/^\d+$/.test(val) && val.length > 2 && !val.includes('บาท') && !val.includes('กก.')) {
              explicitDriver = val;
              break;
            }
          }
        }

        // If carrierCode is empty, check nearby columns (44, 46, 43, 47, 48, 12)
        if (!carrierCode || carrierCode === '0' || carrierCode === '-') {
          for (const cIdx of [44, 46, 43, 47, 48, 12, 13]) {
            const candidate = String(row[cIdx] || '').trim();
            if (
              candidate &&
              candidate !== '0' &&
              candidate !== '-' &&
              (/^[Dd]\d{1,2}$/.test(candidate) || (candidate.length <= 4 && /^\d{1,2}$/.test(candidate)))
            ) {
              carrierCode = candidate;
              break;
            }
          }
        }
      } else if (Object.keys(colIndexMap).length >= 3) {
        // Generic detected columns mode
        if (colIndexMap['ticketNo'] !== undefined) {
          rawTicketNo = String(row[colIndexMap['ticketNo']] || '').trim();
        } else if (row[0] && (/^[A-Za-z0-9\-_]{4,}/.test(String(row[0]).trim()) || /^\d{4,}/.test(String(row[0]).trim()))) {
          rawTicketNo = String(row[0]).trim();
        }

        if (colIndexMap['plate'] !== undefined) plate = String(row[colIndexMap['plate']] || '').trim();
        if (colIndexMap['customer'] !== undefined) customer = String(row[colIndexMap['customer']] || '').trim();
        if (colIndexMap['product'] !== undefined) product = String(row[colIndexMap['product']] || '').trim();
        if (colIndexMap['weightIn'] !== undefined) weightIn = Number(row[colIndexMap['weightIn']]) || 0;
        if (colIndexMap['weightOut'] !== undefined) weightOut = Number(row[colIndexMap['weightOut']]) || 0;
        if (colIndexMap['weightNet'] !== undefined) weightNet = Number(row[colIndexMap['weightNet']]) || 0;
        if (colIndexMap['carrierCode'] !== undefined) carrierCode = String(row[colIndexMap['carrierCode']] || '').trim();
        if (colIndexMap['price'] !== undefined) price = Number(row[colIndexMap['price']]) || 0;

        if (colIndexMap['driver'] !== undefined) {
          explicitDriver = String(row[colIndexMap['driver']] || '').trim();
        }
        if (colIndexMap['quantity'] !== undefined) {
          const parsedQ = Number(row[colIndexMap['quantity']]);
          if (!isNaN(parsedQ) && parsedQ > 0) explicitQuantity = parsedQ;
        }

        // Check detail column (e.g. รายละเอียด: คอนกรีต, ทรายขาย, หินขาย, หินผลิต, ทรายผลิต)
        if (colIndexMap['detail'] !== undefined) {
          const detailVal = String(row[colIndexMap['detail']] || '').trim();
          if (detailVal === 'คอนกรีต') {
            if (/^\d{3}$/.test(product)) {
              product = `คอนกรีต ST${product} (คิว)`;
            } else if (!product.includes('คอนกรีต')) {
              product = `คอนกรีต ${product} (คิว)`;
            }
            if (colIndexMap['quantity'] !== undefined) {
              const qVal = Number(row[colIndexMap['quantity']]);
              if (!isNaN(qVal) && qVal > 0) explicitQuantity = qVal;
            }
          } else if (detailVal.includes('ทรายขาย')) {
            product = 'ทราย(ขาย)คิว';
            if (colIndexMap['quantity'] !== undefined) {
              const qVal = Number(row[colIndexMap['quantity']]);
              if (!isNaN(qVal) && qVal > 0) explicitQuantity = qVal;
            }
          } else if (detailVal.includes('หินขาย')) {
            product = 'หิน3/4(ขาย) คิว';
            if (colIndexMap['quantity'] !== undefined) {
              const qVal = Number(row[colIndexMap['quantity']]);
              if (!isNaN(qVal) && qVal > 0) explicitQuantity = qVal;
            }
          } else if (detailVal.includes('หินผลิต')) {
            product = 'หิน3/4(ผลิตคอนกรีต)กก.';
            if (colIndexMap['quantity'] !== undefined) {
              const wVal = Number(row[colIndexMap['quantity']]);
              if (!isNaN(wVal) && wVal > 0) weightNet = wVal;
            }
          } else if (detailVal.includes('ทรายผลิต')) {
            product = 'ทราย(ผลิต)กก.';
            if (colIndexMap['quantity'] !== undefined) {
              const wVal = Number(row[colIndexMap['quantity']]);
              if (!isNaN(wVal) && wVal > 0) weightNet = wVal;
            }
          }
        }

        dateIn = (colIndexMap['dateIn'] !== undefined && row[colIndexMap['dateIn']] !== undefined && row[colIndexMap['dateIn']] !== '')
          ? row[colIndexMap['dateIn']]
          : (row[1] || row[2] || '');
        timeIn = (colIndexMap['timeIn'] !== undefined && row[colIndexMap['timeIn']] !== undefined && row[colIndexMap['timeIn']] !== '')
          ? row[colIndexMap['timeIn']]
          : (row[6] || row[7] || row[2] || '');
        dateOut = (colIndexMap['dateOut'] !== undefined && row[colIndexMap['dateOut']] !== undefined && row[colIndexMap['dateOut']] !== '')
          ? row[colIndexMap['dateOut']]
          : (row[10] || row[11] || dateIn);
        timeOut = (colIndexMap['timeOut'] !== undefined && row[colIndexMap['timeOut']] !== undefined && row[colIndexMap['timeOut']] !== '')
          ? row[colIndexMap['timeOut']]
          : (row[16] || row[17] || timeIn);

        if (!dateIn || dateIn === '') {
          const kchMatch = rawTicketNo.match(/^KCH(\d{2})(\d{2})(\d{2})/i) || rawTicketNo.match(/^(\d{2})(\d{2})(\d{2})/);
          if (kchMatch) {
            let yy = parseInt(kchMatch[1], 10);
            if (yy < 100) yy += 2000;
            dateIn = `${yy}-${kchMatch[2]}-${kchMatch[3]}`;
            dateOut = dateIn;
          } else if (sheetDefaultDate) {
            dateIn = sheetDefaultDate;
            dateOut = dateIn;
          }
        }
      } else {
        // Compact fallback
        rawTicketNo = String(row[0] || '').trim();
        dateIn = row[1] || '';
        timeIn = row[2] || '';
        dateOut = row[3] || dateIn;
        timeOut = row[4] || timeIn;
        plate = row[5] || '';
        customer = row[6] || '';
        product = row[7] || '';
        weightIn = Number(row[8]) || 0;
        weightOut = Number(row[9]) || 0;
        weightNet = Number(row[10]) || 0;
        price = Number(row[11]) || 0;
        carrierCode = String(row[12] || '').trim();
        if (row[13]) explicitDriver = String(row[13]).trim();

        if (!carrierCode || carrierCode === '0') {
          for (let c = 0; c < row.length; c++) {
            const val = String(row[c] || '').trim();
            if (/^[Dd]\d{1,2}$/.test(val)) {
              carrierCode = val;
              break;
            }
          }
        }

        if (!dateIn && sheetDefaultDate) {
          dateIn = sheetDefaultDate;
          dateOut = dateIn;
        }
      }

      // Check if this row is a valid data record
      // Must have identity (ticketNo or plate or product) and data (weight or date or quantity)
      const hasIdentity = Boolean(rawTicketNo || plate || product);
      const hasData = (weightIn > 0 || weightOut > 0 || weightNet > 0 || dateIn !== '' || (explicitQuantity !== undefined && explicitQuantity > 0));

      if (!hasIdentity || !hasData) {
        totalBlankRows++;
        continue;
      }

      // Ensure ticket is not a summary row masquerading with a number
      if (
        (customer && (customer.includes('รวม') || customer.includes('total'))) ||
        (product && (product.includes('รวม') || product.includes('total'))) ||
        (plate && (plate.includes('รวม') || plate.includes('total')))
      ) {
        totalHeaderFooterRows++;
        continue;
      }

      // If ticket number is empty, fallback to generated sequence
      if (!rawTicketNo) {
        rawTicketNo = `TK-${(dateIn || 'REC').replace(/[^0-9]/g, '')}-${allTickets.length + 1}`;
      }

      // Format dates
      const normalizedDateIn = normalizeDate(dateIn);
      const normalizedDateOut = normalizeDate(dateOut) || normalizedDateIn;

      // Calculate net weight
      const finalWeightIn = weightIn;
      const finalWeightOut = weightOut;
      let calculatedNet = weightNet;
      if (!calculatedNet || calculatedNet <= 0) {
        if (finalWeightIn > 0 && finalWeightOut > 0) {
          calculatedNet = Math.abs(finalWeightIn - finalWeightOut);
        } else if (finalWeightIn > 0) {
          calculatedNet = finalWeightIn;
        } else if (finalWeightOut > 0) {
          calculatedNet = finalWeightOut;
        } else {
          calculatedNet = 0;
        }
      }

      const ticket = enrichTicket(
        {
          ticketNumber: rawTicketNo,
          dateIn: normalizedDateIn,
          timeIn: String(timeIn).trim() || '08:00',
          dateOut: normalizedDateOut,
          timeOut: String(timeOut).trim() || '08:00',
          plateNumber: String(plate).trim(),
          customerName: String(customer).trim(),
          productName: String(product).trim(),
          weightIn: finalWeightIn,
          weightOut: finalWeightOut,
          weightNet: calculatedNet,
          price,
          carrierCode,
          driverName: explicitDriver || undefined,
          quantity: explicitQuantity,
          isQuantityOverridden: explicitQuantity !== undefined,
        },
        settings
      );

      allTickets.push(ticket);
      sheetParsedTickets++;
    }

    if (sheetParsedTickets > 0) {
      parsedSheetNames.push(targetSheetName);
    }
  }

  const sheetDisplay = parsedSheetNames.length > 1
    ? `${parsedSheetNames.join(', ')} (${parsedSheetNames.length} ชีท)`
    : (parsedSheetNames[0] || workbook.SheetNames[0] || 'Sheet1');

  if (allTickets.length === 0) {
    warnings.push(`ตรวจไม่พบแถวรายการข้อมูลตาชั่งในไฟล์ — กรุณาตรวจความถูกต้องของไฟล์ Excel`);
  } else if (parsedSheetNames.length > 1) {
    warnings.push(`ดึงข้อมูลรวมจาก ${parsedSheetNames.length} ชีท (${parsedSheetNames.join(', ')}) รวมทั้งหมด ${allTickets.length} บิล`);
  }

  const totalSkippedRows = totalMergedSecondLines + totalHeaderFooterRows + totalBlankRows;

  return {
    tickets: allTickets,
    sheetName: sheetDisplay,
    sheetNames: parsedSheetNames,
    totalSheetRows,
    parsedRows: allTickets.length,
    mergedSecondLines: totalMergedSecondLines,
    headerFooterRows: totalHeaderFooterRows,
    blankRows: totalBlankRows,
    skippedRows: totalSkippedRows,
    warnings,
  };
}

/**
 * Parses a master settings Excel file (master_ตั้งค่าระบบ.xlsx)
 */
export async function parseMasterSettingsExcel(file: File): Promise<Partial<PlantSettings>> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const updatedSettings: Partial<PlantSettings> = {};

  // Parse 'transfer' sheet
  if (workbook.SheetNames.includes('transfer')) {
    const sheet = workbook.Sheets['transfer'];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    if (rows.length > 0) {
      updatedSettings.products = rows.map((r, idx) => ({
        id: `prod_${idx}`,
        code: String(r['รหัสสินค้า'] || r['รหัส'] || r['code'] || `P${idx + 1}`).trim(),
        name: normalizeThaiText(r['ชื่อสินค้า'] || r['สินค้า'] || r['productName'] || ''),
        unit: r['หน่วย'] || (String(r['สินค้า']).includes('คอนกรีต') ? 'คิว' : 'ตัน'),
        kgPerUnit: Number(r['กก./หน่วย'] || r['อัตราแปลง'] || r['kgPerUnit']) || 1000,
        direction: (r['ทิศทาง'] === 'เข้า' || r['direction'] === 'in') ? 'in' : 'out',
        countTrip: r['นับเที่ยว'] !== false && r['นับเที่ยว'] !== 'ไม่',
        category: String(r['ชื่อสินค้า'] || '').includes('คอนกรีต') ? 'concrete' : 'other',
      }));
    }
  }

  // Parse 'truck' sheet
  if (workbook.SheetNames.includes('truck')) {
    const sheet = workbook.Sheets['truck'];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    if (rows.length > 0) {
      updatedSettings.trucks = rows.map((r) => ({
        carrierCode: String(r['รหัสผู้ขนส่ง'] || r['carrierCode'] || '').trim(),
        plateNumber: normalizePlate(String(r['ทะเบียนรถ'] || r['plateNumber'] || '')),
        truckNumber: String(r['เบอร์รถ'] || r['truckNumber'] || '').trim(),
        truckType: r['ประเภทรถ'] || r['truckType'] || 'อื่นๆ',
        driverName: normalizeThaiText(r['คนขับ'] || r['ชื่อผู้ขนส่ง'] || r['ชื่อคนขับ'] || r['driverName'] || ''),
        commissionType: (r['วิธีคิดค่าคอม'] === 'ต่อเที่ยว' || r['commissionType'] === 'per_trip') ? 'per_trip' : 'per_cue',
        commissionRate: Number(r['อัตรา'] || r['commissionRate']) || 0,
        isInternal: r['สังกัด'] !== 'ภายนอก',
      }));
    }
  }

  return updatedSettings;
}

/**
 * Sanitizes and truncates a sheet name to ensure it strictly conforms to Excel's rules:
 * 1. Sheet names cannot exceed 31 characters
 * 2. Sheet names cannot contain characters: \ / ? * [ ] :
 * 3. Sheet names cannot start or end with single quote (')
 * 4. Sheet names cannot be empty
 * 5. If existingNames set is provided, ensures sheet names are unique
 */
export function sanitizeSheetName(
  rawName: string,
  fallback: string = 'Sheet',
  existingNames?: Set<string>
): string {
  // Remove prohibited characters: \ / ? * [ ] :
  let clean = (rawName || '')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim();

  if (!clean) clean = fallback;

  // Max 31 characters
  if (clean.length > 31) {
    clean = clean.substring(0, 31).trim();
  }
  if (!clean) clean = fallback.substring(0, 31);

  if (existingNames) {
    let candidate = clean;
    let counter = 1;
    while (existingNames.has(candidate.toLowerCase())) {
      const suffix = `_${counter}`;
      const maxBaseLen = 31 - suffix.length;
      candidate = `${clean.substring(0, maxBaseLen)}${suffix}`;
      counter++;
    }
    existingNames.add(candidate.toLowerCase());
    return candidate;
  }

  return clean;
}

/**
 * Exports Daily Bill Sheet (File 004 format) to Excel (.xlsx)
 * When date range contains multiple days, creates:
 * 1. "สรุปภาพรวม" sheet: Overall period summary, daily breakdown table, truck/driver/grade summaries
 * 2. Dedicated sheets for each day (สร้างชีทเป็นรายวัน e.g. "2026-08-01") containing that day's tickets and summaries
 */
export function exportDailyBillsToExcel(
  date: string,
  tickets: WeighTicket[],
  truckSummary: { truckNumber: string; plateNumber: string; cues: number; trips: number; driverName?: string }[],
  gradeSummary: { grade: string; cues: number; trips: number }[],
  diff: number,
  driverSummary?: { driverName: string; cues: number; trips: number }[]
) {
  const wb = XLSX.utils.book_new();
  const existingSheetNames = new Set<string>();

  // Distinct dates in the ticket list, sorted chronologically
  const uniqueDates = Array.from(
    new Set(tickets.map((t) => t.dateIn).filter(Boolean))
  ).sort();

  // Helper: format tickets into standard excel rows
  const formatTicketRows = (tList: WeighTicket[]) => {
    return tList.map((t, idx) => ({
      'ลำดับ': idx + 1,
      'เลขที่ใบชั่ง': t.ticketNumber,
      'วันที่': t.dateIn,
      'เวลาเข้า': t.timeIn,
      'เวลาออก': t.timeOut,
      'ทะเบียนรถ': t.plateNumber,
      'เบอร์รถ': t.truckNumber || '-',
      'พนักงานขับรถ': t.driverName || '-',
      'ชื่อลูกค้า': t.customerName || 'ไม่ระบุ',
      'สินค้า/เกรด': t.productName || 'ไม่ระบุ',
      'นน.เข้า (กก.)': t.weightIn,
      'นน.ออก (กก.)': t.weightOut,
      'นน.สุทธิ (กก.)': t.weightNet,
      'จำนวน': t.quantity,
      'หน่วย': t.quantityUnit,
      'ราคา': t.price,
      'วิธีจับคู่': t.matchedBy === 'code' ? 'รหัสผู้ขนส่ง' : t.matchedBy === 'plate' ? 'ทะเบียนรถ' : 'ไม่พบ',
    }));
  };

  // If multiple days are selected, add an Overview sheet first
  if (uniqueDates.length > 1) {
    const concreteTickets = tickets.filter((t) => t.isConcrete);
    const totalCues = concreteTickets.reduce((sum, t) => sum + t.quantity, 0);
    const rawInTickets = tickets.filter((t) => t.direction === 'in');
    const totalRawTons = rawInTickets.reduce((sum, t) => sum + t.weightNet / 1000, 0);

    const overviewRows: any[] = [
      { 'ข้อมูล': 'รายงาน', 'ค่า': 'สรุปบิลประจำวัน (แบ่งชีทรายวัน)' },
      { 'ข้อมูล': 'ช่วงวันที่เลือก', 'ค่า': date || `${uniqueDates[0]} ถึง ${uniqueDates[uniqueDates.length - 1]}` },
      { 'ข้อมูล': 'จำนวนวันทำการ', 'ค่า': `${uniqueDates.length} วัน` },
      { 'ข้อมูล': 'จำนวนใบชั่งรวมทั้งหมด', 'ค่า': `${tickets.length} ใบ` },
      { 'ข้อมูล': 'ยอดผลิตคอนกรีตรวม', 'ค่า': `${totalCues.toFixed(1)} คิว (${concreteTickets.length} เที่ยว)` },
      { 'ข้อมูล': 'วัตถุดิบรับเข้าโรงงานรวม', 'ค่า': `${totalRawTons.toFixed(2)} ตัน` },
      {},
      { 'ข้อมูล': '=== สรุปภาพรวมการผลิตและการจัดส่งแยกตามรายวัน ===' },
      ...uniqueDates.map((d) => {
        const dTickets = tickets.filter((t) => t.dateIn === d);
        const dConcrete = dTickets.filter((t) => t.isConcrete);
        const dCues = dConcrete.reduce((sum, t) => sum + t.quantity, 0);
        const dRaw = dTickets.filter((t) => t.direction === 'in');
        const dRawTons = dRaw.reduce((sum, t) => sum + t.weightNet / 1000, 0);
        return {
          'ข้อมูล': d,
          'ค่า': `ดูรายละเอียดที่ชีท [${d}]`,
          'จำนวนใบชั่ง': dTickets.length,
          'เที่ยวคอนกรีต': dConcrete.length,
          'คอนกรีต (คิว)': Math.round(dCues * 10) / 10,
          'วัตถุดิบรับเข้า (ตัน)': Math.round(dRawTons * 100) / 100,
        };
      }),
      {},
      { 'ข้อมูล': '--- รวมสรุปคิวคอนกรีตแยกตามคันรถ (ทั้งช่วงวันที่) ---' },
      ...truckSummary.map((ts) => ({
        'ข้อมูล': `เบอร์ ${ts.truckNumber}`,
        'ค่า': ts.plateNumber,
        'จำนวนใบชั่ง': `${ts.trips} เที่ยว`,
        'เที่ยวคอนกรีต': `${ts.cues.toFixed(1)} คิว`,
      })),
    ];

    if (driverSummary && driverSummary.length > 0) {
      overviewRows.push(
        {},
        { 'ข้อมูล': '--- รวมสรุปคิวคอนกรีตแยกตามพนักงานขับรถ (ทั้งช่วงวันที่) ---' },
        ...driverSummary.map((ds) => ({
          'ข้อมูล': ds.driverName,
          'ค่า': `${ds.trips} เที่ยว`,
          'จำนวนใบชั่ง': `${ds.cues.toFixed(1)} คิว`,
        }))
      );
    }

    overviewRows.push(
      {},
      { 'ข้อมูล': '--- รวมสรุปคิวคอนกรีตแยกตามเกรด (ทั้งช่วงวันที่) ---' },
      ...gradeSummary.map((gs) => ({
        'ข้อมูล': gs.grade,
        'ค่า': `${gs.trips} เที่ยว`,
        'จำนวนใบชั่ง': `${gs.cues.toFixed(1)} คิว`,
      })),
      {},
      {
        'ข้อมูล': 'ผลต่างรวม (Diff คันรถ - เกรด)',
        'ค่า': `${diff.toFixed(2)} คิว`,
        'จำนวนใบชั่ง': diff === 0 ? 'สมดุล (ตรงกัน)' : 'มีผลต่างที่ต้องตรวจสอบ',
      }
    );

    const wsOverview = XLSX.utils.json_to_sheet(overviewRows);
    const overviewSheetName = sanitizeSheetName('สรุปภาพรวม', 'ภาพรวม', existingSheetNames);
    XLSX.utils.book_append_sheet(wb, wsOverview, overviewSheetName);
  }

  // Generate a dedicated sheet for each day (สร้างชีทเป็นรายวัน)
  if (uniqueDates.length === 0) {
    const wsEmpty = XLSX.utils.json_to_sheet([{ 'ข้อความ': 'ไม่มีข้อมูลใบชั่งในช่วงวันที่เลือก' }]);
    const emptySheetName = sanitizeSheetName('ไม่มีข้อมูล', 'Sheet1', existingSheetNames);
    XLSX.utils.book_append_sheet(wb, wsEmpty, emptySheetName);
  } else {
    uniqueDates.forEach((dayDate) => {
      const dayTickets = tickets.filter((t) => t.dateIn === dayDate);
      const dayTicketData = formatTicketRows(dayTickets);
      const wsDay = XLSX.utils.json_to_sheet(dayTicketData);

      const dayConcrete = dayTickets.filter((t) => t.isConcrete);

      // 1. Truck summary for this day
      const truckMap = new Map<string, { truckNumber: string; plateNumber: string; cues: number; trips: number }>();
      dayConcrete.forEach((t) => {
        const key = t.truckNumber || t.plateNumber || 'ไม่ระบุ';
        const curr = truckMap.get(key) || {
          truckNumber: t.truckNumber || '-',
          plateNumber: t.plateNumber || '-',
          cues: 0,
          trips: 0,
        };
        curr.cues += t.quantity;
        curr.trips += 1;
        truckMap.set(key, curr);
      });
      const dayTruckSummary = Array.from(truckMap.values()).sort((a, b) => b.cues - a.cues);

      // 2. Driver summary for this day
      const driverMap = new Map<string, { driverName: string; cues: number; trips: number }>();
      dayConcrete.forEach((t) => {
        const key = t.driverName || 'ไม่ระบุคนขับ';
        const curr = driverMap.get(key) || { driverName: key, cues: 0, trips: 0 };
        curr.cues += t.quantity;
        curr.trips += 1;
        driverMap.set(key, curr);
      });
      const dayDriverSummary = Array.from(driverMap.values()).sort((a, b) => b.cues - a.cues);

      // 3. Grade summary for this day
      const gradeMap = new Map<string, { grade: string; cues: number; trips: number }>();
      dayConcrete.forEach((t) => {
        const grade = t.productName || 'ไม่ระบุเกรด';
        const curr = gradeMap.get(grade) || { grade, cues: 0, trips: 0 };
        curr.cues += t.quantity;
        curr.trips += 1;
        gradeMap.set(grade, curr);
      });
      const dayGradeSummary = Array.from(gradeMap.values()).sort((a, b) => b.cues - a.cues);

      // 4. Day diff
      const dayTotalTruckCues = dayTruckSummary.reduce((sum, t) => sum + t.cues, 0);
      const dayTotalGradeCues = dayGradeSummary.reduce((sum, g) => sum + g.cues, 0);
      const dayDiff = Math.round((dayTotalTruckCues - dayTotalGradeCues) * 100) / 100;

      // Standard CP Plant Side-by-side Summary: ทะเบียนรถ & เกรดคอนกรีต
      const stdPlates = ['82-7428', '83-0174', '83-2049', '83-3183', '83-4384', '83-5036', '83-5161'];
      const stdStrengths = ['180', '210', '240', '280', '320'];

      const truckPlateCues = new Map<string, number>();
      stdPlates.forEach((p) => truckPlateCues.set(p, 0));
      dayConcrete.forEach((t) => {
        const p = t.plateNumber || 'ไม่ระบุ';
        truckPlateCues.set(p, (truckPlateCues.get(p) || 0) + t.quantity);
      });

      const strengthCues = new Map<string, number>();
      stdStrengths.forEach((s) => strengthCues.set(s, 0));
      dayConcrete.forEach((t) => {
        const match = (t.productName || '').match(/\b(180|210|240|280|300|320|350|400)\b/) || (t.productName || '').match(/\d{3}/);
        const s = match ? match[0] : (t.productName || 'ไม่ระบุ');
        strengthCues.set(s, (strengthCues.get(s) || 0) + t.quantity);
      });

      const sortedPlates = Array.from(truckPlateCues.keys()).sort((a, b) => a.localeCompare(b, 'th'));
      const sortedStrengths = Array.from(strengthCues.keys()).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b, 'th');
      });

      const plantTableMaxRows = Math.max(sortedPlates.length, sortedStrengths.length);
      const sideBySideRows: any[] = [
        {},
        { 'ลำดับ': '=== ตารางสรุปมาตรฐานโรงงาน (ทะเบียนรถ & เกรดคอนกรีต) ===' },
        {
          'ลำดับ': 'ทะเบียนรถ',
          'เลขที่ใบชั่ง': 'จำนวน (คิว)',
          'วันที่': '',
          'เวลาเข้า': 'คอนกรีต',
          'เวลาออก': 'จำนวน (คิว)',
        },
      ];

      for (let i = 0; i < plantTableMaxRows; i++) {
        const p = sortedPlates[i];
        const s = sortedStrengths[i];
        sideBySideRows.push({
          'ลำดับ': p || '',
          'เลขที่ใบชั่ง': p ? Number((truckPlateCues.get(p) || 0).toFixed(2)) : '',
          'วันที่': '',
          'เวลาเข้า': s || '',
          'เวลาออก': s ? Number((strengthCues.get(s) || 0).toFixed(2)) : '',
        });
      }

      sideBySideRows.push({
        'ลำดับ': 'รวม',
        'เลขที่ใบชั่ง': Number(dayTotalTruckCues.toFixed(2)),
        'วันที่': '',
        'เวลาเข้า': 'รวม',
        'เวลาออก': Number(dayTotalGradeCues.toFixed(2)),
      });

      const daySummaryRows: any[] = [
        ...sideBySideRows,
        {},
        { 'ลำดับ': `=== สรุปประจำวันที่ ${dayDate} ===` },
        {
          'ลำดับ': `รวมยอดคอนกรีต: ${dayTotalTruckCues.toFixed(1)} คิว | ${dayConcrete.length} เที่ยว | ใบชั่งทั้งหมด: ${dayTickets.length} ใบ`,
        },
        {},
        { 'ลำดับ': '--- สรุปคิวคอนกรีตแยกตามคันรถ ---' },
        ...dayTruckSummary.map((ts) => ({
          'ลำดับ': `เบอร์ ${ts.truckNumber}`,
          'เลขที่ใบชั่ง': ts.plateNumber,
          'วันที่': '',
          'เวลาเข้า': `${ts.trips} เที่ยว`,
          'เวลาออก': `${ts.cues.toFixed(1)} คิว`,
        })),
        {},
        { 'ลำดับ': '--- สรุปคิวคอนกรีตแยกตามพนักงานขับรถ ---' },
        ...dayDriverSummary.map((ds) => ({
          'ลำดับ': ds.driverName,
          'เลขที่ใบชั่ง': `${ds.trips} เที่ยว`,
          'วันที่': '',
          'เวลาเข้า': `${ds.cues.toFixed(1)} คิว`,
        })),
        {},
        { 'ลำดับ': '--- สรุปคิวคอนกรีตแยกตามเกรด ---' },
        ...dayGradeSummary.map((gs) => ({
          'ลำดับ': gs.grade,
          'เลขที่ใบชั่ง': `${gs.trips} เที่ยว`,
          'วันที่': '',
          'เวลาเข้า': `${gs.cues.toFixed(1)} คิว`,
        })),
        {},
        {
          'ลำดับ': 'ผลต่าง (Diff คันรถ - เกรด)',
          'เลขที่ใบชั่ง': `${dayDiff.toFixed(2)} คิว`,
          'วันที่': '',
          'เวลาเข้า': dayDiff === 0 ? 'สมดุล (ตรงกัน)' : 'มีผลต่างที่ต้องตรวจสอบ',
        },
      ];

      XLSX.utils.sheet_add_json(wsDay, daySummaryRows, { skipHeader: true, origin: -1 });

      // Clean sheet name e.g. "2026-08-01"
      const daySheetName = sanitizeSheetName(dayDate, `วัน_${dayDate}`, existingSheetNames);
      XLSX.utils.book_append_sheet(wb, wsDay, daySheetName);
    });
  }

  const safeFileName = (date || 'รายวัน').replace(/[\\/:*?"<>|]/g, '_');
  XLSX.writeFile(wb, `รายงานสรุปบิลรายวัน_${safeFileName}.xlsx`);
}

/**
 * Exports Driver Commission Report (File 08 format)
 * คำนวณจากค่าหลักคือ "รหัสผู้ขนส่ง" ในไฟล์ที่นำเข้า และระบุทะเบียนรถในรายละเอียดการวิ่ง
 */
export function exportDriverCommissionToExcel(driverSummaries: DriverSummary[], monthLabel: string = 'รายงวด') {
  const wb = XLSX.utils.book_new();

  // Main summary sheet: รวมคิวรถโม่
  const mainSheetData = driverSummaries.map((d) => ({
    'พนักงานขับรถ': d.driverName,
    'รหัสผู้ขนส่ง': d.carrierCode || '-',
    'ทะเบียนรถที่ขับวิ่งงาน': (d.trucksDriven && d.trucksDriven.length > 0)
      ? d.trucksDriven.join(', ')
      : (d.plateNumber || '-'),
    'จำนวนคันที่ขับ': d.trucksDriven?.length || 1,
    'จำนวนเที่ยว': d.totalTrips,
    'จำนวนคิว': Math.round(d.totalCues * 10) / 10,
    'ค่าคอมมิชชั่น (บาท)': Math.round(d.totalCommission * 100) / 100,
    'ที่มาการระบุคนขับ': d.matchedFromCodeCount > 0 ? 'รหัสผู้ขนส่งในไฟล์ตาชั่ง' : 'ทะเบียนรถประจำ (สำรอง)',
  }));

  const existingSheetNames = new Set<string>();
  const mainSheetName = sanitizeSheetName('รวมคิวรถโม่', 'Summary', existingSheetNames);
  const wsMain = XLSX.utils.json_to_sheet(mainSheetData);
  XLSX.utils.book_append_sheet(wb, wsMain, mainSheetName);

  // Individual sheets per driver with daily trips - explicitly showing license plate driven
  driverSummaries.forEach((drv) => {
    const drvRows = drv.dailyTrips.map((dt) => ({
      'ว/ด/ป': dt.date,
      'เที่ยวที่ของวัน': dt.tripIndex,
      'ลำดับสะสม': dt.cumulativeTrip,
      'เวลา': dt.timeOut,
      'เลขบิล': dt.ticketNumber,
      'ทะเบียนรถ': dt.plateNumber, // ระบุทะเบียนรถในรายละเอียดการวิ่ง
      'เบอร์รถ': dt.truckNumber !== '-' ? dt.truckNumber : '',
      'ประเภทรถ': dt.truckType !== '-' ? dt.truckType : '',
      'ปลายทาง/ลูกค้า': dt.destination,
      'สเต็ง/เกรด': dt.grade,
      'จำนวนคิว': dt.cues,
      'คิวสะสม': dt.cumulativeCues,
      'ค่าคอม (บาท)': dt.commission,
    }));

    const wsDrv = XLSX.utils.json_to_sheet(drvRows);
    const fallback = drv.carrierCode ? `ผู้ขนส่ง_${drv.carrierCode}` : 'Driver';
    const safeSheetName = sanitizeSheetName(drv.driverName, fallback, existingSheetNames);
    XLSX.utils.book_append_sheet(wb, wsDrv, safeSheetName);
  });

  const safeMonth = (monthLabel || 'รายบุคคล').replace(/[\\/:*?"<>|]/g, '_');
  XLSX.writeFile(wb, `ค่าคอมมิชชั่นรายบุคคล_${safeMonth}.xlsx`);
}

/**
 * Exports Master Settings Excel template (master_ตั้งค่าระบบ.xlsx)
 */
export function exportMasterSettingsToExcel(settings: PlantSettings) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: transfer
  const transferData = settings.products.map((p) => ({
    'รหัสสินค้า': p.code || '',
    'ชื่อสินค้า': p.name,
    'หน่วย': p.unit,
    'กก./หน่วย': p.kgPerUnit,
    'ทิศทาง': p.direction === 'out' ? 'ออก' : p.direction === 'in' ? 'เข้า' : 'ภายใน',
    'นับเที่ยว': p.countTrip ? 'ใช่' : 'ไม่',
    'หมวดหมู่': p.category,
  }));
  const wsTransfer = XLSX.utils.json_to_sheet(transferData);
  XLSX.utils.book_append_sheet(wb, wsTransfer, 'transfer');

  // 2. Sheet: truck (ทะเบียนรถ ผูกกับ เบอร์รถ กับ ประเภทรถ กับ วิธีคิดค่าคอม กับ อัตรา (บาท) กับ คนขับ)
  const truckData = settings.trucks.map((t) => ({
    'ทะเบียนรถ': t.plateNumber,
    'เบอร์รถ': t.truckNumber,
    'ประเภทรถ': t.truckType,
    'วิธีคิดค่าคอม': t.commissionType === 'per_cue' ? 'ต่อคิว' : 'ต่อเที่ยว',
    'อัตรา (บาท)': t.commissionRate,
    'คนขับ': t.driverName,
  }));
  const wsTruck = XLSX.utils.json_to_sheet(truckData);
  XLSX.utils.book_append_sheet(wb, wsTruck, 'truck');

  // 3. Sheet: carrier_driver (ตารางรหัสผู้ขนส่ง, คนขับ)
  const carrierDriverData = (settings.carrierDrivers || []).map((cd) => ({
    'รหัสผู้ขนส่ง': cd.carrierCode,
    'คนขับ': cd.driverName,
    'หมายเหตุ': cd.note || '',
  }));
  const wsCarrierDriver = XLSX.utils.json_to_sheet(carrierDriverData);
  XLSX.utils.book_append_sheet(wb, wsCarrierDriver, 'carrier_driver');

  // 4. Sheet: อ่านก่อน (Instructions)
  const readmeData = [
    { 'หัวข้อ': 'วิธีใช้งาน', 'คำอธิบาย': 'ไฟล์นี้ใช้กำหนดค่ามาสเตอร์ของระบบตาชั่งคอนกรีต' },
    { 'หัวข้อ': 'ข้อควรระวัง', 'คำอธิบาย': 'ห้ามเปลี่ยนชื่อชีท (transfer, truck, carrier_driver) และห้ามเปลี่ยนชื่อหัวคอลัมน์' },
    { 'หัวข้อ': 'การแก้ไขสินค้า', 'คำอธิบาย': 'สามารถเพิ่มแถวสินค้าใหม่และกำหนดอัตราแปลง กก./หน่วย ได้เอง' },
    { 'หัวข้อ': 'ตารางรถและค่าคอม (truck)', 'คำอธิบาย': 'ผูก ทะเบียนรถ + เบอร์รถ + ประเภทรถ + วิธีคิดค่าคอม + อัตรา (บาท) + คนขับ' },
    { 'หัวข้อ': 'ตารางรหัสผู้ขนส่ง (carrier_driver)', 'คำอธิบาย': 'ผูก รหัสผู้ขนส่ง + คนขับ ระบบจะดึงรหัสผู้ขนส่งในไฟล์บิลมาเทียบเพื่อระบุคนขับก่อนเสมอ' },
  ];
  const wsReadme = XLSX.utils.json_to_sheet(readmeData);
  XLSX.utils.book_append_sheet(wb, wsReadme, 'อ่านก่อน');

  XLSX.writeFile(wb, 'master_ตั้งค่าระบบ.xlsx');
}

/**
 * Export Dashboard 1-Page Summary to Excel
 */
export function exportDashboard1PageExcel(
  startDate: string,
  endDate: string,
  stats: {
    totalTickets: number;
    totalConcreteCues: number;
    totalTrips: number;
    dayCount: number;
    avgCuesPerDay: number;
    rawMaterialTons: number;
    totalCommission: number;
    auditCount: number;
  },
  topProducts: { name: string; cues: number; trips: number; share: number }[],
  topDrivers: { driver: string; truckNo: string; plate: string; cues: number; trips: number }[],
  dailyTrends: { date: string; cues: number; trips: number; rawTons: number }[]
) {
  const wb = XLSX.utils.book_new();

  // Single sheet layout
  const rows: any[] = [
    { 'A': 'รายงานสรุปภาพรวมโรงงานคอนกรีต (Dashboard 1-Page Summary)', 'B': '', 'C': '', 'D': '', 'E': '' },
    { 'A': `ช่วงวันที่: ${startDate || 'ทั้งหมด'} ถึง ${endDate || 'ทั้งหมด'} (${stats.dayCount} วันทำการ) | พิมพ์วันที่: ${new Date().toLocaleDateString('th-TH')}`, 'B': '', 'C': '', 'D': '', 'E': '' },
    {},
    { 'A': '=== 1. สรุปตัวชี้วัดหลัก (KPIs Summary) ===', 'B': '', 'C': '', 'D': '', 'E': '' },
    { 'A': 'ตัวชี้วัด', 'B': 'ยอดรวม', 'C': 'หน่วย', 'D': 'หมายเหตุ', 'E': '' },
    { 'A': 'คอนกรีตผสมเสร็จขายออก', 'B': Number(stats.totalConcreteCues.toFixed(1)), 'C': 'คิว', 'D': `${stats.totalTrips} เที่ยวขนส่ง` },
    { 'A': 'เฉลี่ยผลิตต่อวัน', 'B': Number(stats.avgCuesPerDay.toFixed(1)), 'C': 'คิว/วัน', 'D': `คำนวณจาก ${stats.dayCount} วันที่มีรายการ` },
    { 'A': 'วัตถุดิบรับเข้า (หิน/ทราย/ปูน)', 'B': Number(stats.rawMaterialTons.toFixed(1)), 'C': 'ตัน', 'D': 'นน.สุทธิวัตถุดิบรับเข้าแพล้นท์' },
    { 'A': 'ค่าคอมมิชชั่นพนักงานขับรถรวม', 'B': Number(stats.totalCommission.toFixed(2)), 'C': 'บาท', 'D': 'ประมาณการตามเรทในระบบ' },
    { 'A': 'จำนวนใบชั่งทั้งหมดในช่วง', 'B': stats.totalTickets, 'C': 'บิล', 'D': stats.auditCount > 0 ? `พบ ${stats.auditCount} รายการที่ต้องตรวจสอบ` : 'ตรวจสอบครบถ้วน' },
    {},
    { 'A': '=== 2. สรุปแยกตามสินค้าและเกรดคอนกรีต (Product Breakdown) ===', 'B': '', 'C': '', 'D': '', 'E': '' },
    { 'A': 'สินค้า / เกรด', 'B': 'จำนวนคิว', 'C': 'สัดส่วน (%)', 'D': 'จำนวนเที่ยว', 'E': 'เฉลี่ย คิว/เที่ยว' },
    ...topProducts.map((p) => ({
      'A': p.name,
      'B': Number(p.cues.toFixed(1)),
      'C': `${p.share.toFixed(1)}%`,
      'D': p.trips,
      'E': p.trips > 0 ? Number((p.cues / p.trips).toFixed(1)) : 0,
    })),
    {},
    { 'A': '=== 3. สรุปผลงานพนักงานขับรถและรถโม่ (Driver & Truck Summary) ===', 'B': '', 'C': '', 'D': '', 'E': '' },
    { 'A': 'พนักงานขับรถ', 'B': 'เบอร์รถ', 'C': 'ทะเบียน', 'D': 'จำนวนคิวรวม', 'E': 'จำนวนเที่ยว' },
    ...topDrivers.map((d) => ({
      'A': d.driver,
      'B': d.truckNo ? `เบอร์ ${d.truckNo}` : '-',
      'C': d.plate || '-',
      'D': Number(d.cues.toFixed(1)),
      'E': d.trips,
    })),
    {},
    { 'A': '=== 4. สรุปการผลิตรายวัน (Daily Production Trend) ===', 'B': '', 'C': '', 'D': '', 'E': '' },
    { 'A': 'วันที่', 'B': 'คิวคอนกรีต', 'C': 'เที่ยววิ่ง', 'D': 'วัตถุดิบเข้า (ตัน)', 'E': '' },
    ...dailyTrends.map((dt) => ({
      'A': dt.date,
      'B': Number(dt.cues.toFixed(1)),
      'C': dt.trips,
      'D': Number(dt.rawTons.toFixed(1)),
      'E': '',
    })),
  ];

  const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });

  // Column widths
  ws['!cols'] = [
    { wch: 35 },
    { wch: 18 },
    { wch: 16 },
    { wch: 25 },
    { wch: 18 },
  ];

  // Page setup for printing/exporting strictly to 1 page in Excel
  (ws as any)['!pageSetup'] = {
    fitToWidth: 1,
    fitToHeight: 1,
    orientation: 'portrait',
    paperSize: 9, // A4
  };
  (ws as any)['!sheetPr'] = { pageSetUpPr: { fitToPage: true } };
  (ws as any)['!margins'] = {
    left: 0.3,
    right: 0.3,
    top: 0.4,
    bottom: 0.4,
    header: 0.2,
    footer: 0.2,
  };

  XLSX.utils.book_append_sheet(wb, ws, 'Dashboard_1Page');
  const safeStart = startDate || 'All';
  const safeEnd = endDate || 'All';
  XLSX.writeFile(wb, `Dashboard_Summary_1Page_${safeStart}_${safeEnd}.xlsx`);
}
