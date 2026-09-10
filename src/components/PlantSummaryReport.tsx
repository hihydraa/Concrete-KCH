import React, { useMemo, useState } from 'react';
import { TruckConfig, WeighTicket } from '../types';
import { Copy, Check, FileSpreadsheet, Layers, Truck, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PlantSummaryReportProps {
  tickets: WeighTicket[];
  truckSettings: TruckConfig[];
  selectedDate?: string;
  availableDates?: string[];
  onSelectDate?: (date: string) => void;
}

/**
 * Extracts standard concrete strength from product names
 * e.g. "คอนกรีต 240 ksc", "คอนกรีต 180 ksc (หยาบ)", "คอนกรีตผสมเสร็จ 280" -> "240", "180", "280"
 */
export function extractConcreteStrength(productName: string | undefined): string {
  if (!productName) return 'ไม่ระบุเกรด';
  const str = String(productName).trim();
  const match = str.match(/\b(180|210|240|280|300|320|350|400|450)\b/) || str.match(/(180|210|240|280|300|320|350|400|450)/);
  if (match) return match[1];
  const numMatch = str.match(/\d{3}/);
  if (numMatch) return numMatch[0];
  return str;
}

export const PlantSummaryReport: React.FC<PlantSummaryReportProps> = ({
  tickets,
  truckSettings,
  selectedDate,
  availableDates = [],
  onSelectDate,
}) => {
  const [copied, setCopied] = useState(false);

  // Filter only concrete tickets
  const concreteTickets = useMemo(() => {
    return tickets.filter((t) => t.isConcrete);
  }, [tickets]);

  // 1. Truck Summary Table (Sorted by plate number ascending)
  const truckTable = useMemo(() => {
    // Get all mixer trucks from settings
    const mixerTrucks = truckSettings
      .filter((t) => (t.truckType || '').includes('โม่'))
      .map((t) => ({
        plateNumber: t.plateNumber,
        truckNumber: t.truckNumber,
        driverName: t.driverName,
        truckType: t.truckType,
      }));

    // Map existing tickets
    const cuesMap = new Map<string, number>();
    concreteTickets.forEach((t) => {
      const plate = t.plateNumber || 'ไม่ระบุ';
      cuesMap.set(plate, (cuesMap.get(plate) || 0) + t.quantity);
    });

    // Ensure all mixer trucks from master settings are included
    const result: { plateNumber: string; truckNumber: string; cues: number }[] = [];
    const seenPlates = new Set<string>();

    mixerTrucks.forEach((trk) => {
      seenPlates.add(trk.plateNumber);
      result.push({
        plateNumber: trk.plateNumber,
        truckNumber: trk.truckNumber,
        cues: cuesMap.get(trk.plateNumber) || 0,
      });
    });

    // Also include any other plate that delivered concrete in these tickets
    cuesMap.forEach((cues, plate) => {
      if (!seenPlates.has(plate)) {
        result.push({
          plateNumber: plate,
          truckNumber: '-',
          cues,
        });
      }
    });

    // Sort by plateNumber ascending (e.g. 82-7428, 83-0174, 83-2049, 83-3183, 83-4384, 83-5036, 83-5161)
    result.sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, 'th'));

    const totalCues = result.reduce((sum, r) => sum + r.cues, 0);

    return {
      rows: result,
      totalCues,
    };
  }, [concreteTickets, truckSettings]);

  // 2. Concrete Strength Table (180, 210, 240, 280, 320, etc.)
  const concreteStrengthTable = useMemo(() => {
    // Standard CP plant strengths (must always be displayed, even if 0.00)
    const standardStrengths = ['180', '210', '240', '280', '320'];

    const cuesMap = new Map<string, number>();
    // Pre-populate standard strengths with 0
    standardStrengths.forEach((s) => cuesMap.set(s, 0));

    concreteTickets.forEach((t) => {
      const strength = extractConcreteStrength(t.productName);
      cuesMap.set(strength, (cuesMap.get(strength) || 0) + t.quantity);
    });

    // Collect all strengths
    const allStrengths = Array.from(cuesMap.keys()).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'th');
    });

    const rows = allStrengths.map((s) => ({
      strength: s,
      cues: cuesMap.get(s) || 0,
    }));

    const totalCues = rows.reduce((sum, r) => sum + r.cues, 0);

    return {
      rows,
      totalCues,
    };
  }, [concreteTickets]);

  const diff = Math.round((truckTable.totalCues - concreteStrengthTable.totalCues) * 100) / 100;
  const isBalanced = Math.abs(diff) < 0.01;

  // Format date display (e.g. 01/09/26)
  const formattedDateTitle = useMemo(() => {
    if (!selectedDate) return 'ทุกช่วงเวลา';
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const y = parts[0].substring(2, 4);
      return `${parts[2]}/${parts[1]}/${y} (${parts[1] === '09' ? 'Sep' : parts[1] === '08' ? 'Aug' : parts[1]})`;
    }
    return selectedDate;
  }, [selectedDate]);

  // Copy as TSV (Tab Separated Values) for pasting into Excel
  const handleCopyTables = () => {
    let tsv = `ตารางสรุปคิวคอนกรีตประจำวันที่ ${formattedDateTitle}\n\n`;
    tsv += `ทะเบียนรถ\tจำนวน\t\tคอนกรีต\tจำนวน\n`;

    const maxRows = Math.max(truckTable.rows.length, concreteStrengthTable.rows.length);
    for (let i = 0; i < maxRows; i++) {
      const trk = truckTable.rows[i];
      const str = concreteStrengthTable.rows[i];
      const trkCol = trk ? `${trk.plateNumber}\t${trk.cues.toFixed(2)}` : '\t';
      const strCol = str ? `${str.strength}\t${str.cues.toFixed(2)}` : '\t';
      tsv += `${trkCol}\t\t${strCol}\n`;
    }

    tsv += `รวม\t${truckTable.totalCues.toFixed(2)}\t\tรวม\t${concreteStrengthTable.totalCues.toFixed(2)}\n`;

    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Export as standalone Excel file
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const exportRows: any[] = [
      { 'ทะเบียนรถ': `รายงานสรุปคิวคอนกรีตประจำวัน: ${formattedDateTitle}` },
      {},
      { 'ทะเบียนรถ': 'ทะเบียนรถ', 'จำนวน (ตามคันรถ)': 'จำนวน (คิว)', ' ': '', 'คอนกรีต': 'คอนกรีต', 'จำนวน (ตามเกรด)': 'จำนวน (คิว)' },
    ];

    const maxRows = Math.max(truckTable.rows.length, concreteStrengthTable.rows.length);
    for (let i = 0; i < maxRows; i++) {
      const trk = truckTable.rows[i];
      const str = concreteStrengthTable.rows[i];
      exportRows.push({
        'ทะเบียนรถ': trk ? trk.plateNumber : '',
        'จำนวน (ตามคันรถ)': trk ? Number(trk.cues.toFixed(2)) : '',
        ' ': '',
        'คอนกรีต': str ? str.strength : '',
        'จำนวน (ตามเกรด)': str ? Number(str.cues.toFixed(2)) : '',
      });
    }

    exportRows.push(
      {
        'ทะเบียนรถ': 'รวม',
        'จำนวน (ตามคันรถ)': Number(truckTable.totalCues.toFixed(2)),
        ' ': '',
        'คอนกรีต': 'รวม',
        'จำนวน (ตามเกรด)': Number(concreteStrengthTable.totalCues.toFixed(2)),
      },
      {},
      {
        'ทะเบียนรถ': 'ผลต่างตรวจสอบ',
        'จำนวน (ตามคันรถ)': `${diff.toFixed(2)} คิว`,
        ' ': isBalanced ? 'สมดุล (ตรงกัน)' : 'มีผลต่าง',
      }
    );

    const ws = XLSX.utils.json_to_sheet(exportRows, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, ws, 'สรุปคอนกรีตประจำวัน');
    XLSX.writeFile(wb, `สรุปคอนกรีต_${selectedDate || 'all'}.xlsx`);
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-orange-100 text-orange-800">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <h3 className="font-bold text-slate-900 text-base">
              ตารางสรุปมาตรฐานโรงงาน (ทะเบียนรถ & เกรดคอนกรีต)
            </h3>
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                สมดุล (Diff: 0.00)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                ผลต่าง: {diff.toFixed(2)} คิว
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            รายงานประจำวัน {formattedDateTitle} • ยอดจัดส่งรวม{' '}
            <span className="font-bold text-slate-800">{truckTable.totalCues.toFixed(2)} คิว</span> ({concreteTickets.length} เที่ยว)
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyTables}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            title="คัดลอกตารางเพื่อนำไปวางใน Excel หรือ Line"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกตาราง'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

      {/* Date Switcher Pills (If availableDates provided) */}
      {availableDates.length > 0 && onSelectDate && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
          <span className="text-slate-500 flex items-center gap-1 font-medium mr-1">
            <Calendar className="w-3.5 h-3.5" />
            เลือกวันที่:
          </span>
          {availableDates.map((d) => {
            const isSelected = selectedDate === d;
            const parts = d.split('-');
            const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDate(d)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {label}
                {d === '2026-09-01' ? ' ⭐' : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Side-by-side Tables: [ทะเบียนรถ | จำนวน] and [คอนกรีต | จำนวน] */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Table: ทะเบียนรถ | จำนวน */}
        <div className="overflow-hidden rounded-xl border border-slate-300 shadow-xs">
          <div className="bg-[#F8DFD4] px-4 py-2.5 border-b border-slate-300 flex items-center justify-between">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-orange-900" />
              <span>สรุปตามทะเบียนรถ</span>
            </div>
            <span className="text-xs text-slate-600 font-medium">
              {truckTable.rows.length} คัน
            </span>
          </div>

          <table className="w-full text-xs sm:text-sm divide-y divide-slate-200">
            <thead>
              <tr className="bg-[#F8DFD4]/50 text-slate-800 font-bold border-b border-slate-300">
                <th scope="col" className="py-2.5 px-4 text-left">
                  ทะเบียนรถ
                </th>
                <th scope="col" className="py-2.5 px-4 text-right">
                  จำนวน (คิว)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {truckTable.rows.map((row) => (
                <tr
                  key={row.plateNumber}
                  className={`hover:bg-amber-50/50 transition-colors ${
                    row.cues > 0 ? 'font-medium text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <td className="py-2 px-4 font-mono font-semibold text-slate-800">
                    {row.plateNumber}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-slate-900">
                    {row.cues.toFixed(2)}
                  </td>
                </tr>
              ))}
              {truckTable.rows.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-400 text-xs">
                    ไม่มีข้อมูลรถคอนกรีตในวันที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8DFD4] font-bold text-slate-900 border-t-2 border-slate-400">
                <td className="py-2.5 px-4 text-left">
                  รวม
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-base text-orange-950">
                  {truckTable.totalCues.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Right Table: คอนกรีต | จำนวน */}
        <div className="overflow-hidden rounded-xl border border-slate-300 shadow-xs">
          <div className="bg-[#F8DFD4] px-4 py-2.5 border-b border-slate-300 flex items-center justify-between">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-orange-900" />
              <span>สรุปตามเกรดคอนกรีต</span>
            </div>
            <span className="text-xs text-slate-600 font-medium">
              {concreteStrengthTable.rows.length} เกรด
            </span>
          </div>

          <table className="w-full text-xs sm:text-sm divide-y divide-slate-200">
            <thead>
              <tr className="bg-[#F8DFD4]/50 text-slate-800 font-bold border-b border-slate-300">
                <th scope="col" className="py-2.5 px-4 text-left">
                  คอนกรีต (Strength)
                </th>
                <th scope="col" className="py-2.5 px-4 text-right">
                  จำนวน (คิว)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {concreteStrengthTable.rows.map((row) => (
                <tr
                  key={row.strength}
                  className={`hover:bg-amber-50/50 transition-colors ${
                    row.cues > 0 ? 'font-medium text-slate-900' : 'text-slate-400'
                  }`}
                >
                  <td className="py-2 px-4 font-mono font-semibold text-slate-800">
                    {row.strength}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-slate-900">
                    {row.cues.toFixed(2)}
                  </td>
                </tr>
              ))}
              {concreteStrengthTable.rows.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-400 text-xs">
                    ไม่มีข้อมูลเกรดคอนกรีตในวันที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8DFD4] font-bold text-slate-900 border-t-2 border-slate-400">
                <td className="py-2.5 px-4 text-left">
                  รวม
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-base text-orange-950">
                  {concreteStrengthTable.totalCues.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary Verification Bar */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">การตรวจสอบความถูกต้อง:</span>
          <span>รวมตามคันรถ: <strong className="font-mono text-slate-900">{truckTable.totalCues.toFixed(2)}</strong> คิว</span>
          <span>=</span>
          <span>รวมตามเกรดคอนกรีต: <strong className="font-mono text-slate-900">{concreteStrengthTable.totalCues.toFixed(2)}</strong> คิว</span>
        </div>
        <div className="font-medium">
          {isBalanced ? (
            <span className="text-emerald-700 flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-600" />
              ยอดรวมตรงกัน 100% (สมดุล)
            </span>
          ) : (
            <span className="text-amber-700 flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              ผลต่าง {diff.toFixed(2)} คิว (กรุณาตรวจสอบบิล)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
