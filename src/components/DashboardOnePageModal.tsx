import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Printer,
  Download,
  X,
  PackageCheck,
  TrendingUp,
  Truck,
  FileCheck,
  Percent,
} from 'lucide-react';

interface DashboardOnePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  stats: {
    totalTickets: number;
    totalConcreteCues: number;
    totalTrips: number;
    dayCount: number;
    avgCuesPerDay: number;
    rawMaterialTons: number;
    totalCommission: number;
    auditCount: number;
  };
  topProducts: { name: string; cues: number; trips: number; share: number }[];
  driverStats: { driver: string; truckNo: string; plate: string; cues: number; trips: number }[];
  dailyTrends: { date: string; cues: number; trips: number; rawTons: number }[];
  onExportExcel: () => void;
}

export const DashboardOnePageModal: React.FC<DashboardOnePageModalProps> = ({
  isOpen,
  onClose,
  startDate,
  endDate,
  stats,
  topProducts,
  driverStats,
  dailyTrends,
  onExportExcel,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [printScale, setPrintScale] = useState<number>(95);

  if (!isOpen) return null;

  const handlePrint = () => {
    document.body.classList.add('printing-one-page');
    const cleanup = () => {
      document.body.classList.remove('printing-one-page');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // Safety fallback
    setTimeout(() => {
      document.body.classList.remove('printing-one-page');
    }, 1500);
  };

  // Limit products to top 5 + "Other" summary row to guarantee strict height limit
  const maxProducts = 5;
  const visibleProducts = topProducts.slice(0, maxProducts);
  const remainingProducts = topProducts.slice(maxProducts);
  const otherProductsCues = remainingProducts.reduce((sum, p) => sum + p.cues, 0);
  const otherProductsTrips = remainingProducts.reduce((sum, p) => sum + p.trips, 0);
  const otherProductsShare = remainingProducts.reduce((sum, p) => sum + p.share, 0);

  // Limit drivers to top 5 + "Other" summary row
  const maxDrivers = 5;
  const visibleDrivers = driverStats.slice(0, maxDrivers);
  const remainingDrivers = driverStats.slice(maxDrivers);
  const otherDriversCues = remainingDrivers.reduce((sum, d) => sum + d.cues, 0);
  const otherDriversTrips = remainingDrivers.reduce((sum, d) => sum + d.trips, 0);

  // Compact daily trends: split into 2 columns if > 6 days, or compact summary
  const isMultiColDaily = dailyTrends.length > 6;
  const halfDaily = Math.ceil(dailyTrends.length / 2);
  const dailyCol1 = isMultiColDaily ? dailyTrends.slice(0, halfDaily) : dailyTrends;
  const dailyCol2 = isMultiColDaily ? dailyTrends.slice(halfDaily) : [];

  return (
    <AnimatePresence>
      <div
        id="dashboard-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      >
        <motion.div
          id="dashboard-modal-card"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-auto overflow-hidden border border-slate-300 flex flex-col max-h-[96vh]"
        >
          {/* Action Toolbar (Strictly hidden during print) */}
          <div className="p-3 sm:p-4 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2.5 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-wide">
                📄 รายงานแดชบอร์ดสรุป 1 หน้า (1-Page Dashboard)
              </span>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/40 font-medium">
                ✅ พอดี A4 1 หน้า
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Zoom / Scale selector */}
              <div className="flex items-center gap-1 bg-slate-700/80 px-2 py-1 rounded-lg text-xs">
                <Percent className="w-3 h-3 text-slate-400" />
                <span className="text-slate-300 text-[11px]">ขนาดพิมพ์:</span>
                <select
                  value={printScale}
                  onChange={(e) => setPrintScale(Number(e.target.value))}
                  className="bg-slate-800 text-white text-xs rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value={100}>100% (ปกติ)</option>
                  <option value={95}>95% (แนะนำพอดี A4)</option>
                  <option value={90}>90% (กระชับ)</option>
                  <option value={85}>85% (ขอบกว้าง)</option>
                </select>
              </div>

              <button
                id="btn-modal-export-1page-excel"
                onClick={onExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                title="ดาวน์โหลดเป็นไฟล์ Excel ที่ตั้งค่าหน้ากระดาษพอดี 1 หน้า"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel 1 หน้า</span>
              </button>

              <button
                id="btn-modal-print-1page-pdf"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                title="พิมพ์ออกเครื่องพิมพ์ หรือเลือก 'บันทึกเป็น PDF' (1 หน้าพอดี)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์ / บันทึก PDF (1 หน้า)</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scroll container for screen preview */}
          <div
            id="printable-dashboard-1page-scroll-container"
            className="overflow-y-auto p-2 sm:p-4 bg-slate-100 flex justify-center"
          >
            {/* The 1-Page Printable Root Container */}
            <div
              ref={printRef}
              id="printable-dashboard-1page"
              style={{ zoom: `${printScale}%` }}
              className="bg-white w-full max-w-[210mm] shadow-md border border-slate-300 p-4 sm:p-5 rounded-xl text-slate-900 text-xs box-border"
            >
              {/* 1. Document Header */}
              <div className="border-b-2 border-slate-800 pb-2 mb-2.5 flex items-start justify-between">
                <div>
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                    รายงานสรุปภาพรวมโรงงานคอนกรีตผสมเสร็จ (1-Page Executive Dashboard)
                  </h1>
                  <p className="text-[10px] sm:text-xs text-slate-600 font-medium">
                    ระบบรายงานตาชั่งรายวันและวิเคราะห์ผลการดำเนินงานขนส่งคอนกรีต
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-600 space-y-0.5 font-mono">
                  <div>
                    ช่วงวันที่:{' '}
                    <strong className="text-slate-900 font-bold">
                      {startDate || 'ทั้งหมด'} ถึง {endDate || 'ทั้งหมด'}
                    </strong>{' '}
                    ({stats.dayCount} วันทำการ)
                  </div>
                  <div>
                    พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH')} {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div>
                    จำนวนบิลทั้งหมด: <strong className="text-slate-900">{stats.totalTickets}</strong> ใบ
                  </div>
                </div>
              </div>

              {/* 2. KPI Summary: 6 Compact Boxes */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2 mb-2.5">
                <div className="bg-amber-50/80 border border-amber-200 p-1.5 rounded text-center">
                  <span className="text-[9px] text-amber-800 block font-semibold leading-tight">คอนกรีตขายออก</span>
                  <span className="text-xs sm:text-sm font-black text-amber-950 font-mono block leading-tight">
                    {stats.totalConcreteCues.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-amber-700 leading-tight">คิว ({stats.totalTrips} เที่ยว)</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-1.5 rounded text-center">
                  <span className="text-[9px] text-slate-600 block font-semibold leading-tight">เฉลี่ยต่อวัน</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block leading-tight">
                    {stats.avgCuesPerDay.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-slate-500 leading-tight">คิว / วันทำการ</span>
                </div>

                <div className="bg-blue-50/80 border border-blue-200 p-1.5 rounded text-center">
                  <span className="text-[9px] text-blue-800 block font-semibold leading-tight">วัตถุดิบรับเข้า</span>
                  <span className="text-xs sm:text-sm font-black text-blue-950 font-mono block leading-tight">
                    {stats.rawMaterialTons.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-blue-700 leading-tight">ตัน (หิน/ทราย/ปูน)</span>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200 p-1.5 rounded text-center">
                  <span className="text-[9px] text-emerald-800 block font-semibold leading-tight">ค่าคอมมิชชั่น</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-950 font-mono block leading-tight">
                    ฿{Math.round(stats.totalCommission).toLocaleString()}
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-emerald-700 leading-tight">บาทรวม</span>
                </div>

                <div className="bg-purple-50/80 border border-purple-200 p-1.5 rounded text-center">
                  <span className="text-[9px] text-purple-800 block font-semibold leading-tight">เที่ยววิ่งรวม</span>
                  <span className="text-xs sm:text-sm font-black text-purple-950 font-mono block leading-tight">
                    {stats.totalTrips.toLocaleString()}
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-purple-700 leading-tight">เที่ยวโม่</span>
                </div>

                <div className={`p-1.5 rounded text-center border ${stats.auditCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                  <span className="text-[9px] block font-semibold leading-tight">การตรวจสอบ</span>
                  <span className="text-xs sm:text-sm font-black font-mono block leading-tight">
                    {stats.auditCount > 0 ? `${stats.auditCount} รายการ` : '100%'}
                  </span>
                  <span className="text-[8px] sm:text-[9px] leading-tight">{stats.auditCount > 0 ? 'ต้องตรวจทาน' : 'บิลสมบูรณ์'}</span>
                </div>
              </div>

              {/* 3. Middle Section: Products (Left) & Drivers (Right) */}
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                {/* Products / Concrete Grades */}
                <div className="border border-slate-200 rounded p-1.5 bg-slate-50/30">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                    <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1">
                      <PackageCheck className="w-3 h-3 text-amber-600" />
                      <span>สัดส่วนเกรดคอนกรีต (Product Mix)</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      รวม {topProducts.reduce((s, p) => s + p.cues, 0).toFixed(1)} คิว
                    </span>
                  </div>
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[9px]">
                        <th className="pb-0.5 font-semibold">เกรด / สินค้า</th>
                        <th className="pb-0.5 text-right font-semibold">คิว</th>
                        <th className="pb-0.5 text-right font-semibold">เที่ยว</th>
                        <th className="pb-0.5 text-right font-semibold">สัดส่วน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleProducts.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-0.5 pr-1 truncate max-w-[120px] font-medium text-slate-800">
                            {p.name}
                          </td>
                          <td className="py-0.5 text-right font-mono font-bold text-amber-950">
                            {p.cues.toFixed(1)}
                          </td>
                          <td className="py-0.5 text-right font-mono text-slate-600">
                            {p.trips}
                          </td>
                          <td className="py-0.5 text-right font-mono text-slate-500">
                            {p.share.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      {remainingProducts.length > 0 && (
                        <tr className="text-slate-500 italic bg-slate-100/50">
                          <td className="py-0.5 pr-1 truncate max-w-[120px]">
                            อื่นๆ ({remainingProducts.length} รายการ)
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {otherProductsCues.toFixed(1)}
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {otherProductsTrips}
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {otherProductsShare.toFixed(1)}%
                          </td>
                        </tr>
                      )}
                      {topProducts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-2 text-slate-400">
                            ไม่มีข้อมูลคอนกรีตในช่วงนี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Drivers / Mixer Trucks */}
                <div className="border border-slate-200 rounded p-1.5 bg-slate-50/30">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                    <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-amber-600" />
                      <span>ผลงานพนักงานขับรถ & รถโม่</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {driverStats.length} คน/คัน
                    </span>
                  </div>
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[9px]">
                        <th className="pb-0.5 font-semibold">คนขับ / เบอร์รถ</th>
                        <th className="pb-0.5 text-right font-semibold">คิว</th>
                        <th className="pb-0.5 text-right font-semibold">เที่ยว</th>
                        <th className="pb-0.5 text-right font-semibold">เฉลี่ย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleDrivers.map((d, idx) => (
                        <tr key={idx}>
                          <td className="py-0.5 pr-1 truncate max-w-[120px] font-medium text-slate-800">
                            {d.driver}{' '}
                            <span className="text-[9px] text-slate-500 font-normal">
                              ({d.truckNo ? `#${d.truckNo}` : d.plate})
                            </span>
                          </td>
                          <td className="py-0.5 text-right font-mono font-bold text-slate-900">
                            {d.cues.toFixed(1)}
                          </td>
                          <td className="py-0.5 text-right font-mono text-slate-600">
                            {d.trips}
                          </td>
                          <td className="py-0.5 text-right font-mono text-slate-500">
                            {d.trips > 0 ? (d.cues / d.trips).toFixed(1) : '-'}
                          </td>
                        </tr>
                      ))}
                      {remainingDrivers.length > 0 && (
                        <tr className="text-slate-500 italic bg-slate-100/50">
                          <td className="py-0.5 pr-1 truncate max-w-[120px]">
                            คนขับอื่นๆ ({remainingDrivers.length} คน)
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {otherDriversCues.toFixed(1)}
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {otherDriversTrips}
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {otherDriversTrips > 0 ? (otherDriversCues / otherDriversTrips).toFixed(1) : '-'}
                          </td>
                        </tr>
                      )}
                      {driverStats.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-2 text-slate-400">
                            ไม่มีข้อมูลพนักงานขับรถ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Daily Production Summary (Bounded Height, 1 or 2 Columns) */}
              <div className="border border-slate-200 rounded p-1.5 mb-2.5 bg-slate-50/30">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                  <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-amber-600" />
                    <span>สรุปการผลิตคอนกรีตและรับเข้าวัตถุดิบรายวัน (Daily Production Trend)</span>
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    รวม {dailyTrends.length} วันทำการ | เฉลี่ย {stats.avgCuesPerDay.toFixed(1)} คิว/วัน
                  </span>
                </div>

                {!isMultiColDaily ? (
                  // Single Column Table for <= 6 days
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[9px]">
                        <th className="pb-0.5 font-semibold">วันที่</th>
                        <th className="pb-0.5 text-right font-semibold">คอนกรีตขายออก (คิว)</th>
                        <th className="pb-0.5 text-right font-semibold">เที่ยววิ่ง</th>
                        <th className="pb-0.5 text-right font-semibold">วัตถุดิบรับเข้า (ตัน)</th>
                        <th className="pb-0.5 text-right font-semibold">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyCol1.map((dt, idx) => (
                        <tr key={idx}>
                          <td className="py-0.5 font-mono font-medium text-slate-800">{dt.date}</td>
                          <td className="py-0.5 text-right font-mono font-bold text-amber-950">{dt.cues.toFixed(1)}</td>
                          <td className="py-0.5 text-right font-mono text-slate-600">{dt.trips} เที่ยว</td>
                          <td className="py-0.5 text-right font-mono text-blue-900">{dt.rawTons.toFixed(1)}</td>
                          <td className="py-0.5 text-right text-[9px]">
                            {dt.cues > 0 ? (
                              <span className="text-emerald-700 font-medium">จ่ายปกติ</span>
                            ) : (
                              <span className="text-slate-400 italic">ไม่มีจ่าย</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {dailyTrends.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-2 text-slate-400">
                            ไม่มีข้อมูลในช่วงวันที่เลือก
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  // Two-Column Compact Grid for > 6 days
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 text-[9px]">
                            <th className="pb-0.5 font-semibold">วันที่</th>
                            <th className="pb-0.5 text-right font-semibold">คิว</th>
                            <th className="pb-0.5 text-right font-semibold">เที่ยว</th>
                            <th className="pb-0.5 text-right font-semibold">วัตถุดิบ (ตัน)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dailyCol1.map((dt, idx) => (
                            <tr key={idx}>
                              <td className="py-0.5 font-mono font-medium text-slate-800">{dt.date}</td>
                              <td className="py-0.5 text-right font-mono font-bold text-amber-950">{dt.cues.toFixed(1)}</td>
                              <td className="py-0.5 text-right font-mono text-slate-600">{dt.trips}</td>
                              <td className="py-0.5 text-right font-mono text-blue-900">{dt.rawTons.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 text-[9px]">
                            <th className="pb-0.5 font-semibold">วันที่</th>
                            <th className="pb-0.5 text-right font-semibold">คิว</th>
                            <th className="pb-0.5 text-right font-semibold">เที่ยว</th>
                            <th className="pb-0.5 text-right font-semibold">วัตถุดิบ (ตัน)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dailyCol2.map((dt, idx) => (
                            <tr key={idx}>
                              <td className="py-0.5 font-mono font-medium text-slate-800">{dt.date}</td>
                              <td className="py-0.5 text-right font-mono font-bold text-amber-950">{dt.cues.toFixed(1)}</td>
                              <td className="py-0.5 text-right font-mono text-slate-600">{dt.trips}</td>
                              <td className="py-0.5 text-right font-mono text-blue-900">{dt.rawTons.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Sign-off Footer Block */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-300 text-[9px] text-slate-500 text-center">
                <div>
                  <div className="h-5 border-b border-dashed border-slate-300 mb-0.5" />
                  <span>ผู้จัดทำรายงาน (เจ้าหน้าที่ตาชั่ง)</span>
                </div>
                <div>
                  <div className="h-5 border-b border-dashed border-slate-300 mb-0.5" />
                  <span>ผู้ตรวจสอบ (หัวหน้าแพล้นท์คอนกรีต)</span>
                </div>
                <div>
                  <div className="h-5 border-b border-dashed border-slate-300 mb-0.5" />
                  <span>ผู้อนุมัติ (ผู้จัดการฝ่ายผลิต)</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
