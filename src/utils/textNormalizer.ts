import { CueRounding, PlantSettings, ProductConfig, TruckConfig, CarrierDriverConfig, WeighTicket, CommissionType } from '../types';

/**
 * Normalizes Thai text:
 * - Collapses whitespace
 * - Replaces double เ (เ+เ) with Thai Sara Ae (แ)
 * - Trims edges
 */
export function normalizeThaiText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/\u0e40\u0e40/g, '\u0e41') // เ+เ -> แ
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes truck license plate numbers:
 * - Trims leading/trailing spaces
 * - Fixes known typo variants found in plant weighbridge logs
 */
export function normalizePlate(plate: string | null | undefined): string {
  if (!plate) return '';
  let cleaned = String(plate).trim();
  
  // Specific typos documented in section 4.5
  if (cleaned === '92-7428') cleaned = '82-7428';
  if (cleaned === '82-5259') cleaned = '83-5259';
  if (cleaned === '82-6297') cleaned = '82-6297';
  
  return cleaned;
}

/**
 * Rounding helper for concrete cue calculation
 */
export function roundCue(value: number, rounding: CueRounding): number {
  if (rounding === 'none') return Math.round(value * 100) / 100;
  if (rounding === '0.5') {
    return Math.round(value * 2) / 2;
  }
  if (rounding === '0.25') {
    return Math.round(value * 4) / 4;
  }
  if (rounding === '1.0') {
    return Math.round(value);
  }
  return value;
}

/**
 * Clean Thai string for matching driver names:
 * - Replace all whitespace (including NBSP \u00A0, multiple spaces, tabs) with a single space
 * - Replace double sara-e (\u0e40\u0e40) with sara-ae (\u0e41)
 * - Remove common title prefixes like 'นาย', 'นาง', 'น.ส.'
 * - Trim edges and lowercase
 */
export function cleanDriverName(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\u0e40\u0e40/g, '\u0e41')
    .replace(/^นาย\s*/, '')
    .replace(/^นาง\s*/, '')
    .replace(/^น\.ส\.\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Smart matcher for carrier code / driver from Excel import
 * In plant weighbridge export, both "รหัสผู้ขนส่ง" and "ชื่อผู้ขนส่ง" frequently contain
 * the driver's Thai full name:
 * e.g. จตุพล หัสดี (D05), ประยูร ชุมนุมชาติ (D01), จำลอง ไต่ตาม (D02), อัมพร ภูมิ่งศรี (D10),
 *      ธวีวัฒน์ ทิ้งโคตร (D03), ประดิษฐ์ ภูอาจ (D07), วัชรพล ภูครองแถว (D04),
 *      นัทธชัย เล็กอ่อน (D06), ดนัย ภูงามเชิง (D09), วีรชล จวงสอน (D08)
 *
 * Supports:
 * - Driver name match: exact full name, substring, or first name
 * - Exact carrierCode: 'D01', 'D02', etc.
 * - Numeric variations: '01', '1', 'D1', 'd01', 'D-01' -> matches 'D01'
 * - Truck number variations: '9', '13', '14', '8', '11', '12', '7' -> matches corresponding truck
 * - Exact truckNumber string: 'พ่วง 1', 'เซมิ 1', 'ดั้ม 1'
 */
/**
 * ค้นหาชื่อพนักงานขับรถจากรหัสผู้ขนส่งในไฟล์:
 * 1. ค้นหาในตาราง carrierDrivers ก่อน (ตารางรหัสผู้ขนส่ง, คนขับ)
 * 2. ค้นหาในตาราง trucks (ดู driverName, truckNumber, carrierCode)
 * 3. หากมีค่าระบุมาแต่ไม่ตรงกับตารางใดๆ ให้ส่งคืนค่านั้นโดยตรง
 */
export function matchDriverFromCarrierCode(
  rawCode: string | null | undefined,
  carrierDrivers: CarrierDriverConfig[] = [],
  trucks: TruckConfig[] = []
): string | undefined {
  if (!rawCode) return undefined;
  const clean = String(rawCode).trim();
  if (!clean || clean === '0' || clean === '-' || clean.toLowerCase() === 'null') {
    return undefined;
  }
  const lower = clean.toLowerCase();
  const cName = cleanDriverName(clean);

  // 1. ค้นหาในตาราง carrierDrivers (ตารางรหัสผู้ขนส่ง, คนขับ)
  if (carrierDrivers && carrierDrivers.length > 0) {
    // 1.1 ตรงกับ carrierCode (exact case-insensitive)
    const byCode = carrierDrivers.find((cd) => cd.carrierCode.trim().toLowerCase() === lower);
    if (byCode) return byCode.driverName;

    // 1.2 ถ้าในไฟล์เป็นชื่อคนขับ ตรงกับ driverName หรือ carrierCode ใน carrierDrivers
    if (cName && cName.length >= 2) {
      const byName = carrierDrivers.find((cd) => {
        const cdDriver = cleanDriverName(cd.driverName);
        const cdCode = cleanDriverName(cd.carrierCode);
        return cdDriver === cName || cdCode === cName || cdDriver.includes(cName) || cName.includes(cdDriver);
      });
      if (byName) return byName.driverName;

      // 1.3 ชื่อต้นตรงกัน (e.g. "จตุพล", "ประยูร", "จำลอง", "อัมพร", "ธวีวัฒน์", "ประดิษฐ์", "วัชรพล", "นัทธชัย", "ดนัย", "วีรชล")
      const cFirst = cName.split(' ')[0];
      if (cFirst && cFirst.length >= 3) {
        const byFirst = carrierDrivers.find((cd) => {
          const cdFirst = cleanDriverName(cd.driverName).split(' ')[0];
          return cdFirst === cFirst || (cdFirst.length >= 4 && cName.includes(cdFirst));
        });
        if (byFirst) return byFirst.driverName;
      }
    }
  }

  // 2. ค้นหาในตาราง trucks (ตารางรถ)
  if (trucks && trucks.length > 0) {
    // 2.1 ตรงกับ driverName ใน trucks
    if (cName && cName.length >= 2) {
      const byTruckDriver = trucks.find((t) => {
        const tName = cleanDriverName(t.driverName);
        return tName === cName || tName.includes(cName) || cName.includes(tName);
      });
      if (byTruckDriver) return byTruckDriver.driverName;
    }

    // 2.2 ตรงกับ carrierCode เก่า (ถ้ามี)
    const byOldCode = trucks.find((t) => (t.carrierCode || '').trim().toLowerCase() === lower);
    if (byOldCode) return byOldCode.driverName;

    // 2.3 ตรงกับ truckNumber
    const byTruckNum = trucks.find((t) => t.truckNumber.trim().toLowerCase() === lower);
    if (byTruckNum) return byTruckNum.driverName;
  }

  // 3. หากมีค่าระบุมาในช่องรหัสผู้ขนส่ง แต่ไม่ตรงกับตารางใดๆ ให้ใช้ค่านั้นเป็นชื่อคนขับ
  return clean;
}

export function matchTruckByCarrierOrCode(
  rawCode: string | null | undefined,
  trucks: TruckConfig[],
  plateHint?: string
): TruckConfig | undefined {
  if (!rawCode) return undefined;
  const clean = String(rawCode).trim();
  if (!clean || clean === '0' || clean === '-' || clean.toLowerCase() === 'null') {
    return undefined;
  }
  const lower = clean.toLowerCase();

  // 1. Check Driver Name match first (Thai full name, substring, or first name)
  const cName = cleanDriverName(clean);
  if (cName && cName.length >= 2) {
    let found = trucks.find((t) => cleanDriverName(t.driverName) === cName);
    if (found) return found;

    found = trucks.find((t) => {
      const tName = cleanDriverName(t.driverName);
      return tName.includes(cName) || cName.includes(tName);
    });
    if (found) return found;

    const cFirst = cName.split(' ')[0];
    if (cFirst && cFirst.length >= 3) {
      found = trucks.find((t) => {
        const tFirst = cleanDriverName(t.driverName).split(' ')[0];
        return tFirst === cFirst || (tFirst.length >= 4 && cName.includes(tFirst));
      });
      if (found) return found;
    }
  }

  // 2. Exact match on carrierCode (if present)
  let found = trucks.find((t) => (t.carrierCode || '').toLowerCase() === lower);
  if (found) return found;

  // 3. Exact truckNumber string match
  found = trucks.find((t) => t.truckNumber.trim().toLowerCase() === lower);
  if (found) return found;

  return undefined;
}

/**
 * Parses and fixes dates from weighbridge export
 * Handles ISO dates, Thai Buddhist dates (พ.ศ. 2569 -> 2026), DD/MM/YYYY, MM/DD/YYYY,
 * Thai textual month names (ก.ย., กันยายน), English textual months (Sep, September),
 * Excel serial numbers, and SheetJS Date objects without timezone or US swap errors.
 */
export function normalizeDate(rawDate: string | Date | number): string {
  if (!rawDate && rawDate !== 0) return '';
  
  // 1. If it's a string
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    if (!trimmed) return '';

    // Thai and English month dictionary
    const monthTextMap: Record<string, number> = {
      'ม.ค.': 1, 'มกราคม': 1, 'jan': 1, 'january': 1,
      'ก.พ.': 2, 'กุมภาพันธ์': 2, 'feb': 2, 'february': 2,
      'มี.ค.': 3, 'มีนาคม': 3, 'mar': 3, 'march': 3,
      'เม.ย.': 4, 'เมษายน': 4, 'apr': 4, 'april': 4,
      'พ.ค.': 5, 'พฤษภาคม': 5, 'may': 5,
      'มิ.ย.': 6, 'มิถุนายน': 6, 'jun': 6, 'june': 6,
      'ก.ค.': 7, 'กรกฎาคม': 7, 'jul': 7, 'july': 7,
      'ส.ค.': 8, 'สิงหาคม': 8, 'aug': 8, 'august': 8,
      'ก.ย.': 9, 'กันยายน': 9, 'sep': 9, 'september': 9,
      'ต.ค.': 10, 'ตุลาคม': 10, 'oct': 10, 'october': 10,
      'พ.ย.': 11, 'พฤศจิกายน': 11, 'nov': 11, 'november': 11,
      'ธ.ค.': 12, 'ธันวาคม': 12, 'dec': 12, 'december': 12,
    };

    // Check textual month e.g. "1 ก.ย. 69", "01-ก.ย.-2569", "1-Sep-2026", "08 Sep 2026"
    const lower = trimmed.toLowerCase();
    for (const [mName, mNum] of Object.entries(monthTextMap)) {
      if (lower.includes(mName)) {
        const numbers = trimmed.match(/\d+/g);
        if (numbers && numbers.length >= 2) {
          let day = parseInt(numbers[0], 10);
          let year = parseInt(numbers[1], 10);
          if (year < 100) {
            if (year >= 60) year += 2500 - 543;
            else year += 2000;
          }
          if (year > 2400) year -= 543;
          return `${year}-${String(mNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }

    // If starts with YYYY-MM-DD or YYYY/MM/DD (e.g. "2026-09-01" or "2026-09-01 10:20:00" or ISO string)
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch && parseInt(ymdMatch[1], 10) > 1900) {
      let year = parseInt(ymdMatch[1], 10);
      let month = parseInt(ymdMatch[2], 10);
      let day = parseInt(ymdMatch[3], 10);
      if (year > 2400) year -= 543;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // If DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, or DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (dmyMatch) {
      let num1 = parseInt(dmyMatch[1], 10);
      let num2 = parseInt(dmyMatch[2], 10);
      let year = parseInt(dmyMatch[3], 10);

      // 2-digit year e.g. 26 or 69
      if (year < 100) {
        if (year >= 60) year += 2500 - 543; // e.g. 69 -> 2569 -> 2026
        else year += 2000;
      }
      // Thai Buddhist year (2569 -> 2026)
      if (year > 2400) year -= 543;

      let day = num1;
      let month = num2;

      // Handle US MM/DD vs Thai DD/MM:
      // If exported as "09/01/2026" to "09/08/2026" (month 9, day 1..8):
      if (num1 === 9 && num2 >= 1 && num2 <= 12) {
        day = num2;
        month = 9;
      } else if (num1 === 8 && num2 >= 10 && num2 <= 12) {
        // e.g. "08/10/2026" -> August 10, 2026
        day = num2;
        month = 8;
      }

      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. If Date object or Excel serial number
  let dateObj: Date;
  let isFromSerial = false;
  if (typeof rawDate === 'number') {
    isFromSerial = true;
    // Excel serial date: 25569 days between 1900 and 1970
    dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
  } else if (rawDate instanceof Date) {
    dateObj = rawDate;
  } else {
    dateObj = new Date(rawDate);
  }

  if (isNaN(dateObj.getTime())) return String(rawDate);

  // When SheetJS creates a Date from Excel, it uses UTC timestamp.
  // Extract UTC components to preserve the exact intended calendar date without timezone shift.
  let year = dateObj.getUTCFullYear();
  let month = dateObj.getUTCMonth() + 1;
  let day = dateObj.getUTCDate();

  if (year > 2400) year -= 543;

  // Handle Excel US MM/DD swap in Date objects:
  // 1. September 1-8 entered as DD/MM but interpreted by US Excel as MM/DD -> Day 9, Month 1..8
  // e.g. Jan 9 -> Sep 1, Feb 9 -> Sep 2, ..., Aug 9 -> Sep 8
  if (day === 9 && month >= 1 && month <= 12) {
    day = month;
    month = 9;
  }
  // 2. August 10-12 entered as DD/MM but interpreted by US Excel as MM/DD -> Day 8, Month 10..12
  // e.g. Oct 8 -> Aug 10, Nov 8 -> Aug 11, Dec 8 -> Aug 12
  else if (day === 8 && month >= 10 && month <= 12) {
    day = month;
    month = 8;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Matches a ticket to product and truck settings, deriving all calculated fields
 */
export function enrichTicket(
  rawTicket: Partial<WeighTicket>,
  settings: PlantSettings
): WeighTicket {
  const ticketNumber = String(rawTicket.ticketNumber || '').trim();
  const dateIn = normalizeDate(rawTicket.dateIn || '');
  const timeIn = String(rawTicket.timeIn || '08:00').trim();
  const dateOut = normalizeDate(rawTicket.dateOut || dateIn);
  const timeOut = String(rawTicket.timeOut || timeIn).trim();
  const rawPlate = String(rawTicket.plateNumber || '').trim();
  const plateNumberNormalized = normalizePlate(rawPlate);
  const customerName = normalizeThaiText(rawTicket.customerName);
  const productName = normalizeThaiText(rawTicket.productName);
  const weightIn = Number(rawTicket.weightIn) || 0;
  const weightOut = Number(rawTicket.weightOut) || 0;
  const parsedNet = Number(rawTicket.weightNet) || 0;
  const weightNet = parsedNet > 0 ? parsedNet : Math.abs(weightIn - weightOut);
  const price = Number(rawTicket.price) || 0;
  const carrierCode = String(rawTicket.carrierCode || '').trim();

  // Resolve physical truck by license plate first (does not force driver or vice versa)
  const truckByPlate = plateNumberNormalized
    ? settings.trucks.find((t) => normalizePlate(t.plateNumber) === plateNumberNormalized)
    : undefined;

  // Physical truck characteristics belong to the actual vehicle on the ticket
  const truckNumber = truckByPlate
    ? truckByPlate.truckNumber
    : rawTicket.truckNumber || (rawPlate === 'T100' ? 'ทดสอบ' : '-');
  const truckType = truckByPlate
    ? truckByPlate.truckType
    : rawTicket.truckType || 'อื่นๆ';

  // Find product configuration
  const product = findMatchingProduct(productName, settings.products);
  const isConcrete = product
    ? product.category === 'concrete'
    : (productName.includes('คอนกรีต') || (truckType && truckType.includes('โม่')));
  const direction = product ? product.direction : (isConcrete ? 'out' : 'in');
  const countTrip = product ? product.countTrip : true;
  const kgPerUnit = product ? product.kgPerUnit : (isConcrete ? 2350 : 1000);
  const quantityUnit = product ? product.unit : (isConcrete ? 'คิว' : 'ตัน');

  // Calculate quantity or use manual override if provided
  const rawQuantity = kgPerUnit > 0 ? weightNet / kgPerUnit : 0;
  const autoQuantity = isConcrete ? roundCue(rawQuantity, settings.cueRounding) : Math.round(rawQuantity * 100) / 100;
  const isQuantityOverridden = rawTicket.isQuantityOverridden === true;
  // If user manually edited quantity OR if the source weighbridge file specified an explicit quantity > 0, respect it!
  const quantity = isQuantityOverridden && typeof rawTicket.quantity === 'number'
    ? rawTicket.quantity
    : (typeof rawTicket.quantity === 'number' && rawTicket.quantity > 0
        ? rawTicket.quantity
        : autoQuantity);

  // Driver & Carrier Code Resolution
  // User Rule:
  // 1. การระบุ "รหัสผู้ขนส่ง" จาก Excel เท่ากับการระบุ "พนักงานขับรถ" ในระบบ ให้ดึงค่าจากไฟล์ในคอลัมน์รหัสผู้ขนส่ง มาใส่ในคอลัมน์ พนักงานขับรถ
  // 2. ให้ระบุ คนขับ จาก รหัสผู้ขนส่ง ในไฟล์ก่อน** หากในไฟล์ไม่ได้ระบุ จึงดึงเอาจากตาราง ทะเบียนรถ *****
  const rawDriverOrCarrier = String(rawTicket.carrierCode || rawTicket.driverName || '').trim();
  const hasCarrierInFile = Boolean(
    rawDriverOrCarrier &&
    rawDriverOrCarrier !== '0' &&
    rawDriverOrCarrier !== '-' &&
    rawDriverOrCarrier !== 'ไม่ระบุ' &&
    rawDriverOrCarrier.toLowerCase() !== 'null'
  );

  let finalDriverName = '';
  let finalCarrierCode = rawDriverOrCarrier;
  let matchedBy: 'code' | 'plate' | 'manual' | 'driver' | 'unmatched' =
    rawTicket.matchedBy === 'manual' ? 'manual' : 'unmatched';

  if (hasCarrierInFile) {
    // 1. ระบุ คนขับ จาก รหัสผู้ขนส่ง ในไฟล์ก่อน**
    const resolved = matchDriverFromCarrierCode(
      rawDriverOrCarrier,
      settings.carrierDrivers,
      settings.trucks
    );
    finalDriverName = resolved || rawDriverOrCarrier;
    matchedBy = 'code';
  } else {
    // 2. หากในไฟล์ไม่ได้ระบุ จึงดึงเอาจากตาราง ทะเบียนรถ *****
    if (truckByPlate && truckByPlate.driverName) {
      finalDriverName = truckByPlate.driverName;
      finalCarrierCode = truckByPlate.carrierCode || '-';
      matchedBy = 'plate';
    } else {
      finalDriverName = 'ไม่ระบุ';
      finalCarrierCode = '-';
      matchedBy = 'unmatched';
    }
  }

  if (rawTicket.matchedBy === 'manual' || rawTicket.isOverridden) {
    matchedBy = 'manual';
  }

  const driverName = finalDriverName;

  // Calculate Commission for this driver/trip
  // กฎการคำนวณค่าคอมมิชชั่นรายบุคคล:
  // 1. ผู้ได้รับค่าคอม: คือ finalDriverName (คำนวณจากค่าหลักคือ "รหัสผู้ขนส่ง" ในไฟล์ที่นำเข้า)
  // 2. อัตราและวิธีคิดค่าคอม: เนื่องจากพนักงานขับรถ 1 คน อาจขับรถหลายคัน ดังนั้นการตั้งต้นด้วยทะเบียนรถจึงไม่ถูกต้อง
  //    อัตราค่าคอมของเที่ยวนี้ จึงคำนวณตามรถที่นำไปขับวิ่งจริงในบิล (truckByPlate / ประเภทรถที่วิ่ง):
  //    - หากขับรถโม่ 6 ล้อ -> 11.50 บ./คิว (หรือตามอัตราที่ตั้งไว้ของรถคันนั้น)
  //    - หากขับรถโม่ 10 ล้อ -> 9.00 บ./คิว (หรือตามอัตราที่ตั้งไว้ของรถคันนั้น)
  //    - หากขับรถดั้ม/พ่วง -> 80.00 บ./เที่ยว (หรือตามอัตราที่ตั้งไว้ของรถคันนั้น)
  let commissionType: CommissionType = 'per_cue';
  let commissionRate = 0;

  if (truckByPlate) {
    // ใช้อัตราและวิธีคิดตามรถคันที่นำไปขับวิ่งงานจริงในเที่ยวนี้
    commissionType = truckByPlate.commissionType;
    commissionRate = truckByPlate.commissionRate;
  } else {
    // หากไม่พบข้อมูลทะเบียนรถในตาราง ให้ใช้อัตรามาตรฐานตามประเภทรถ
    if (!isConcrete) {
      commissionType = 'per_trip';
      commissionRate = 80;
    } else {
      commissionType = 'per_cue';
      commissionRate = truckType.includes('6') ? 11.5 : 9.0;
    }
  }

  let commission = 0;
  if (commissionType === 'per_cue') {
    commission = isConcrete ? quantity * commissionRate : 0;
  } else {
    commission = countTrip ? commissionRate : 0;
  }

  // Audit checks (Section 4 & Section 8)
  const auditReasons: string[] = [];
  if (!customerName) {
    auditReasons.push('ไม่ระบุชื่อลูกค้า');
  }
  if (!productName) {
    auditReasons.push('ไม่ระบุสินค้า');
  }
  if (!truckByPlate && !hasCarrierInFile && rawPlate !== 'T100') {
    auditReasons.push(`ทะเบียนไม่พบในระบบ (${rawPlate || 'ว่าง'})`);
  }
  if (
    (driverName === 'ไม่ระบุ' || !driverName) &&
    !hasCarrierInFile
  ) {
    auditReasons.push('ไม่ระบุพนักงานขับรถ');
  }
  if (weightNet === 0 && quantity === 0) {
    auditReasons.push('น้ำหนักสุทธิและจำนวนเป็น 0');
  }

  const needsAudit = auditReasons.length > 0 && 
    (auditReasons.includes('ไม่ระบุชื่อลูกค้า') || 
     auditReasons.includes('ไม่ระบุสินค้า') || 
     auditReasons.includes(`ทะเบียนไม่พบในระบบ (${rawPlate || 'ว่าง'})`) ||
     auditReasons.includes('น้ำหนักสุทธิและจำนวนเป็น 0'));

  return {
    ticketNumber,
    dateIn,
    timeIn,
    dateOut,
    timeOut,
    plateNumber: rawPlate,
    plateNumberNormalized,
    customerName,
    productName: product ? product.name : productName,
    productCode: product ? product.code : rawTicket.productCode,
    weightIn,
    weightOut,
    weightNet,
    price,
    carrierCode: finalCarrierCode || carrierCode,
    truckNumber,
    driverName,
    truckType,
    matchedBy,
    isOverridden: rawTicket.isOverridden || matchedBy === 'manual',
    isQuantityOverridden,
    quantity,
    quantityUnit,
    rawQuantity,
    isConcrete,
    direction,
    countTrip,
    commission,
    commissionType,
    commissionRate,
    needsAudit,
    auditReasons,
  };
}

/**
 * Fuzzy matches product names and codes against settings with high accuracy and strict unit separation
 */
export function findMatchingProduct(productInput: string, products: ProductConfig[]): ProductConfig | undefined {
  if (!productInput) return undefined;
  const raw = String(productInput).trim();
  const normalized = normalizeThaiText(raw);
  const compact = normalized.replace(/[\s\(\)\/_\-]/g, '').toLowerCase();

  // 1. Exact match (by code or name)
  const exact = products.find(
    (p) =>
      (p.code && normalizeThaiText(p.code).toLowerCase() === normalized.toLowerCase()) ||
      normalizeThaiText(p.name).toLowerCase() === normalized.toLowerCase()
  );
  if (exact) return exact;

  // 2. Compact match (by code or name, ignoring whitespace, parens, slashes)
  const compactMatch = products.find(
    (p) =>
      (p.code && normalizeThaiText(p.code).replace(/[\s\(\)\/_\-]/g, '').toLowerCase() === compact) ||
      normalizeThaiText(p.name).replace(/[\s\(\)\/_\-]/g, '').toLowerCase() === compact
  );
  if (compactMatch) return compactMatch;

  // 3. Concrete matching (ST180, ST210, ST240, ST280, ST300, ST320, ST350, ST400, ST450)
  const isConcreteText =
    normalized.includes('คอนกรีต') ||
    normalized.includes('ksc') ||
    /st\s*\d{3}/i.test(normalized) ||
    /^(180|210|240|280|300|320|350|400|450)/i.test(compact);

  if (isConcreteText) {
    const grades = ['450', '400', '350', '320', '300', '280', '240', '210', '180'];
    for (const g of grades) {
      if (normalized.includes(g)) {
        const found = products.find(
          (p) => p.category === 'concrete' && ((p.code && p.code.includes(g)) || p.name.includes(g) || p.id.includes(g))
        );
        if (found) return found;
      }
    }
    // Fallback to any concrete product if grade not specified
    const defaultConc = products.find((p) => p.category === 'concrete');
    if (defaultConc) return defaultConc;
  }

  // 4. Gas (แก๊ส)
  if (normalized.includes('แก๊ส') || normalized.includes('gas')) {
    const gasProd = products.find((p) => p.id === 'gas' || p.code === 'แก๊ส' || p.name.includes('แก๊ส'));
    if (gasProd) return gasProd;
  }

  // 5. Cement (ปูนผง / TPI แดงไฮดรอลิกซ์)
  if (
    normalized.includes('ปูนผง') ||
    normalized.includes('tpi') ||
    normalized.includes('ไฮดรอลิกซ์') ||
    normalized.includes('ปูน')
  ) {
    const cementProd = products.find(
      (p) => p.id === 'cement_tpi' || p.code === 'ปูนผง' || p.name.includes('TPI') || p.category === 'cement'
    );
    if (cementProd) return cementProd;
  }

  // 6. Laterite (ลูกรัง (คิว))
  if (normalized.includes('ลูกรัง')) {
    const lateriteProd = products.find(
      (p) => p.id === 'laterite_cue' || p.code === 'ลูกรัง' || p.category === 'laterite'
    );
    if (lateriteProd) return lateriteProd;
  }

  // 7. Stone (หิน3/4) - MUST strictly separate:
  //    - หิน3/4(ขาย) คิว (ขายออก / หน่วย คิว)
  //    - หิน3/4(ผลิตคอนกรีต)กก. (รับเข้า-ผลิต / หน่วย กก.)
  if (normalized.includes('หิน')) {
    const hasKg = normalized.includes('กก') || normalized.includes('ผลิต') || normalized.includes('รับเข้า');
    const hasCue = normalized.includes('คิว') || normalized.includes('ขาย');

    if (hasKg && !hasCue) {
      const prodKg = products.find(
        (p) =>
          (p.id === 'stone_prod_kg' || (p.code && p.code.includes('ผลิต')) || p.name.includes('ผลิต') || p.name.includes('กก') || p.unit === 'กก.') &&
          p.category === 'stone'
      );
      if (prodKg) return prodKg;
    }
    if (hasCue) {
      const saleCue = products.find(
        (p) =>
          (p.id === 'stone_sale_cue' || (p.code && p.code.includes('ขาย')) || p.name.includes('ขาย') || p.unit === 'คิว') &&
          p.category === 'stone'
      );
      if (saleCue) return saleCue;
    }
    // General stone match fallback
    const stoneKg = products.find((p) => p.id === 'stone_prod_kg');
    const stoneCue = products.find((p) => p.id === 'stone_sale_cue');
    if (normalized.includes('กก') && stoneKg) return stoneKg;
    if (stoneCue) return stoneCue;
    const anyStone = products.find((p) => p.category === 'stone');
    if (anyStone) return anyStone;
  }

  // 8. Sand (ทราย) - MUST strictly distinguish:
  //    - ทราย / ทรายร่วงสายพาน
  //    - ทราย(ขาย)คิว
  //    - ทราย(ผลิต)กก.
  //    - ทราย(หน้าร้าน)กก. / ทราย(ขาย)กก.
  //    - ทรายรองพื้น(กก.) vs ทรายรองพื้น(คิว)
  if (normalized.includes('ทราย') || normalized.includes('สายพาน')) {
    const isSubbase = normalized.includes('รองพื้น');
    const isProd = normalized.includes('ผลิต') || normalized.includes('รับเข้า');
    const isShopFront = normalized.includes('หน้าร้าน');
    const isSale = normalized.includes('ขาย') || isShopFront;
    const isBelt = normalized.includes('สายพาน') || normalized.includes('ร่วง') || compact === 'ทราย';
    const hasKg = normalized.includes('กก') || normalized.includes('ตัน');
    const hasCue = normalized.includes('คิว');

    if (isSubbase) {
      if (hasKg) {
        const subbaseKg = products.find(
          (p) => p.id === 'sand_base_kg' || (p.code === 'ทรายรองพื้น(กก.)') || (p.name.includes('รองพื้น') && p.unit === 'กก.')
        );
        if (subbaseKg) return subbaseKg;
      }
      if (hasCue) {
        const subbaseCue = products.find(
          (p) => p.id === 'sand_base_cue' || (p.code === 'ทรายรองพื้น(คิว)') || (p.name.includes('รองพื้น') && p.unit === 'คิว')
        );
        if (subbaseCue) return subbaseCue;
      }
      const anySubbase = products.find((p) => p.name.includes('รองพื้น'));
      if (anySubbase) return anySubbase;
    }

    if (isShopFront) {
      const shopFrontSand = products.find(
        (p) => p.code === 'ทราย(หน้าร้าน)กก.' || p.id === 'sand_sale_kg' || p.name === 'ทราย(ขาย)กก.'
      );
      if (shopFrontSand) return shopFrontSand;
    }

    if (isBelt) {
      const beltProd = products.find((p) => p.id === 'sand_belt' || p.code === 'ทราย' || p.name.includes('สายพาน'));
      if (beltProd) return beltProd;
    }

    if (isProd) {
      const prodSand = products.find(
        (p) => p.id === 'sand_prod_kg' || p.code === 'ทราย(ผลิต)กก.' || (p.name.includes('ทราย') && (p.name.includes('ผลิต') || p.name.includes('รับเข้า')))
      );
      if (prodSand) return prodSand;
    }

    if (isSale) {
      if (hasKg) {
        const saleKg = products.find(
          (p) => p.id === 'sand_sale_kg' || p.code === 'ทราย(หน้าร้าน)กก.' || (p.name.includes('ขาย') && p.unit === 'กก.')
        );
        if (saleKg) return saleKg;
      }
      if (hasCue) {
        const saleCue = products.find(
          (p) => p.id === 'sand_sale_cue' || p.code === 'ทราย(ขาย)คิว' || (p.name.includes('ขาย') && p.unit === 'คิว')
        );
        if (saleCue) return saleCue;
      }
    }

    // Default sand matching based on unit cues vs kg
    if (hasCue) {
      const anyCueSand = products.find((p) => p.category === 'sand' && p.unit === 'คิว');
      if (anyCueSand) return anyCueSand;
    }
    if (hasKg) {
      const anyKgSand = products.find((p) => p.category === 'sand' && (p.unit === 'กก.' || p.unit === 'ตัน'));
      if (anyKgSand) return anyKgSand;
    }
    const anySand = products.find((p) => p.category === 'sand');
    if (anySand) return anySand;
  }

  // 9. Fallback partial includes
  const partial = products.find(
    (p) =>
      (p.code && (normalized.includes(normalizeThaiText(p.code)) || normalizeThaiText(p.code).includes(normalized))) ||
      normalized.includes(normalizeThaiText(p.name)) ||
      normalizeThaiText(p.name).includes(normalized)
  );
  if (partial) return partial;

  return undefined;
}
