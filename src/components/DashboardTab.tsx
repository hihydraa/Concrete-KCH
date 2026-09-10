import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  Truck,
  Layers,
  Coins,
  AlertTriangle,
  Calendar,
  Filter,
  CheckCircle2,
  ArrowUpRight,
  PackageCheck,
  UserCheck,
  Fuel,
  Info,
  FileText,
  Printer,
  Download,
} from 'lucide-react';
import { PlantSettings, WeighTicket } from '../types';
import { normalizePlate } from '../utils/textNormalizer';
import { DashboardOnePageModal } from './DashboardOnePageModal';
import { exportDashboard1PageExcel } from '../utils/excelParser';
import { PlantSummaryReport } from './PlantSummaryReport';
import { defaultSettings } from '../data/masterSettings';

interface DashboardTabProps {
  tickets: WeighTicket[];
  settings?: PlantSettings;
  onNavigateToRawAudit: () => void;
  onNavigateToDaily: (date: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  tickets,
  settings,
  onNavigateToRawAudit,
  onNavigateToDaily,
}) => {
  // Available dates sorted
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(tickets.map((t) => t.dateIn))).filter(Boolean);
    return dates.sort();
  }, [tickets]);

  // Presets calculation
  const presets = useMemo(() => {
    if (availableDates.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      return {
        today: [today, today],
        last3: [today, today],
        last7: [today, today],
        mtd: [today, today],
        all: [today, today],
      };
    }
    const maxDate = availableDates[availableDates.length - 1];
    const minDate = availableDates[0];
    const last3Start = availableDates[Math.max(0, availableDates.length - 3)];
    const last7Start = availableDates[Math.max(0, availableDates.length - 7)];
    const maxYearMonth = maxDate.slice(0, 7);
    const mtdDates = availableDates.filter((d) => d.startsWith(maxYearMonth));
    const mtdStart = mtdDates.length > 0 ? mtdDates[0] : `${maxYearMonth}-01`;

    return {
      today: [maxDate, maxDate],
      last3: [last3Start, maxDate],
      last7: [last7Start, maxDate],
      mtd: [mtdStart, maxDate],
      all: [minDate, maxDate],
    };
  }, [availableDates]);

  // Start & End Date state (Default to All or MTD for dashboard overview)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (availableDates.length > 0) {
      const minDate = availableDates[0];
      const maxDate = availableDates[availableDates.length - 1];
      if (!startDate || startDate < minDate || startDate > maxDate || !endDate || endDate < minDate || endDate > maxDate) {
        setStartDate(presets.all[0]);
        setEndDate(presets.all[1]);
      }
    }
  }, [availableDates, presets]);

  // Filtered tickets by date range
  const filteredTickets = useMemo(() => {
    if (!startDate && !endDate) return tickets;
    return tickets.filter((t) => {
      if (!t.dateIn) return false;
      if (startDate && t.dateIn < startDate) return false;
      if (endDate && t.dateIn > endDate) return false;
      return true;
    });
  }, [tickets, startDate, endDate]);

  // Preset Handlers
  const applyPreset = (range: [string, string]) => {
    setStartDate(range[0]);
    setEndDate(range[1]);
  };

  const isPresetActive = (range: [string, string]) => {
    return startDate === range[0] && endDate === range[1];
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const concreteTickets = filteredTickets.filter((t) => t.isConcrete);
    const totalConcreteCues = concreteTickets.reduce((sum, t) => sum + t.quantity, 0);
    const totalTrips = concreteTickets.length;

    const dayCount = new Set(concreteTickets.map((t) => t.dateIn)).size || 1;
    const avgCuesPerDay = totalConcreteCues / dayCount;

    const rawInTickets = filteredTickets.filter((t) => t.direction === 'in');
    const rawMaterialTons = rawInTickets.reduce((sum, t) => sum + t.weightNet / 1000, 0);

    const totalCommission = filteredTickets.reduce((sum, t) => sum + t.commission, 0);
    const auditItems = filteredTickets.filter((t) => t.needsAudit);

    return {
      totalTickets: filteredTickets.length,
      totalConcreteCues,
      totalTrips,
      dayCount,
      avgCuesPerDay,
      rawMaterialTons,
      totalCommission,
      auditCount: auditItems.length,
    };
  }, [filteredTickets]);

  // 1. Separate Breakdown: Summary by Truck / Plate Number
  // แสดงผลเฉพาะรถที่มีอยู่ใน "ตาราง รถ" ในตั้งค่าระบบ (settings.trucks) ตามคำขอ
  const truckBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        plateNumber: string;
        truckNumber: string;
        truckType: string;
        trips: number;
        cues: number;
      }
    >();

    const registeredTrucks = settings?.trucks || [];

    filteredTickets
      .filter((t) => t.isConcrete)
      .forEach((t) => {
        const normPlate = normalizePlate(t.plateNumber);
        const tNum = (t.truckNumber || '').trim().toLowerCase();

        // ตรวจสอบว่าตรงกับรถที่มีอยู่ในตารางรถในตั้งค่าระบบหรือไม่
        const matchedTruck = registeredTrucks.find((trk) => {
          const trkNormPlate = normalizePlate(trk.plateNumber);
          const trkTruckNum = trk.truckNumber.trim().toLowerCase();
          if (normPlate && trkNormPlate && normPlate === trkNormPlate) return true;
          if (tNum && trkTruckNum && tNum === trkTruckNum) return true;
          return false;
        });

        // แสดงผลเฉพาะรถที่มีอยู่ใน ตาราง รถ ในตั้งค่าระบบเท่านั้น
        if (!matchedTruck) return;

        const key = matchedTruck.plateNumber || matchedTruck.truckNumber;
        const existing = map.get(key) || {
          plateNumber: matchedTruck.plateNumber,
          truckNumber: matchedTruck.truckNumber || '-',
          truckType: matchedTruck.truckType || 'โม่',
          trips: 0,
          cues: 0,
        };
        existing.trips += 1;
        existing.cues += t.quantity;
        map.set(key, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.cues - a.cues);
  }, [filteredTickets, settings?.trucks]);

  // 2. Separate Breakdown: Summary by Driver
  const driverBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        driverName: string;
        trips: number;
        cues: number;
        commission: number;
      }
    >();

    filteredTickets
      .filter((t) => t.isConcrete)
      .forEach((t) => {
        const key = t.driverName || 'ไม่ระบุคนขับ';
        const existing = map.get(key) || {
          driverName: key,
          trips: 0,
          cues: 0,
          commission: 0,
        };
        existing.trips += 1;
        existing.cues += t.quantity;
        existing.commission += t.commission;
        map.set(key, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.cues - a.cues);
  }, [filteredTickets]);

  // Grade breakdown
  const gradeBreakdown = useMemo(() => {
    const map = new Map<string, { grade: string; cues: number; trips: number }>();
    filteredTickets
      .filter((t) => t.isConcrete)
      .forEach((t) => {
        const grade = t.productName || 'ไม่ระบุเกรด';
        const existing = map.get(grade) || { grade, cues: 0, trips: 0 };
        existing.cues += t.quantity;
        existing.trips += 1;
        map.set(grade, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.cues - a.cues);
  }, [filteredTickets]);

  // Other (non-concrete) product sales breakdown: e.g. ทราย(ขาย), หิน(ขาย), ลูกรัง, ทรายรองพื้น
  const otherSalesBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; unit: string; quantity: number; trips: number; amount: number }
    >();
    filteredTickets
      .filter((t) => t.direction === 'out' && !t.isConcrete)
      .forEach((t) => {
        const name = t.productName || 'สินค้าอื่นๆ';
        const existing = map.get(name) || {
          name,
          unit: t.quantityUnit || '',
          quantity: 0,
          trips: 0,
          amount: 0,
        };
        existing.quantity += t.quantity;
        existing.trips += 1;
        existing.amount += t.price || 0;
        map.set(name, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount || b.quantity - a.quantity);
  }, [filteredTickets]);

  const otherSalesTotalAmount = useMemo(
    () => otherSalesBreakdown.reduce((sum, o) => sum + o.amount, 0),
    [otherSalesBreakdown]
  );

  // Raw materials breakdown
  const rawBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; tons: number; trips: number }>();
    filteredTickets
      .filter((t) => t.direction === 'in')
      .forEach((t) => {
        const name = t.productName || 'วัตถุดิบทั่วไป';
        const existing = map.get(name) || { name, tons: 0, trips: 0 };
        existing.tons += t.weightNet / 1000;
        existing.trips += 1;
        map.set(name, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.tons - a.tons);
  }, [filteredTickets]);

  // Daily trend data (for chart) within the selected range
  const dailyTrends = useMemo(() => {
    const datesInRange = availableDates.filter((d) => {
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    const map = new Map<string, { date: string; cues: number; trips: number; rawTons: number }>();
    datesInRange.forEach((d) => {
      map.set(d, { date: d, cues: 0, trips: 0, rawTons: 0 });
    });

    filteredTickets.forEach((t) => {
      if (!t.dateIn || !map.has(t.dateIn)) return;
      const entry = map.get(t.dateIn)!;
      if (t.isConcrete) {
        entry.cues += t.quantity;
        entry.trips += 1;
      } else if (t.direction === 'in') {
        entry.rawTons += t.weightNet / 1000;
      }
    });

    return Array.from(map.values());
  }, [filteredTickets, availableDates, startDate, endDate]);

  const maxDailyCues = useMemo(() => {
    return Math.max(...dailyTrends.map((d) => d.cues), 50);
  }, [dailyTrends]);

  // 1-Page Export modal and data preparations
  const [is1PageModalOpen, setIs1PageModalOpen] = useState(false);

  const topProductsForExport = useMemo(() => {
    const total = stats.totalConcreteCues || 1;
    return gradeBreakdown.map((g) => ({
      name: g.grade,
      cues: g.cues,
      trips: g.trips,
      share: (g.cues / total) * 100,
    }));
  }, [gradeBreakdown, stats.totalConcreteCues]);

  const driverStatsForExport = useMemo(() => {
    return driverBreakdown.map((d) => {
      const sample = filteredTickets.find((t) => t.driverName === d.driverName);
      return {
        driver: d.driverName,
        truckNo: sample?.truckNumber || '-',
        plate: sample?.plateNumber || '-',
        cues: d.cues,
        trips: d.trips,
      };
    });
  }, [driverBreakdown, filteredTickets]);

  const handleExport1PageExcel = () => {
    exportDashboard1PageExcel(
      startDate,
      endDate,
      stats,
      topProductsForExport,
      driverStatsForExport,
      dailyTrends
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="dashboard-main-view print:hidden space-y-6">
        {/* Date Filter, Preset Bar & 1-Page Export Actions */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Custom Date Range Picker */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-800">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>ช่วงวันที่:</span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-slate-400 text-xs sm:text-sm">ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Quick Preset Buttons & Export 1 Page */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1 hidden sm:inline">เลือกเร็ว:</span>
            <button
              onClick={() => applyPreset(presets.today)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.today)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              วันนี้
            </button>
            <button
              onClick={() => applyPreset(presets.last3)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.last3)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              3 วันล่าสุด
            </button>
            <button
              onClick={() => applyPreset(presets.last7)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.last7)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              7 วันล่าสุด
            </button>
            <button
              onClick={() => applyPreset(presets.mtd)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.mtd)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              เดือนนี้ (MTD)
            </button>
            <button
              onClick={() => applyPreset(presets.all)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.all)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด
            </button>

            {/* Separator */}
            <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

            {/* Export 1 Page Action Buttons */}
            <button
              onClick={() => setIs1PageModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition cursor-pointer"
              title="เปิดตัวอย่างรายงานและพิมพ์ A4 1 หน้า"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ / PDF 1 หน้า</span>
            </button>

            <button
              onClick={handleExport1PageExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
              title="ดาวน์โหลดรายงานสรุป Dashboard หน้าเดียวเป็นไฟล์ Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel 1 หน้า</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            แสดงข้อมูลช่วง: <strong>{startDate || '-'}</strong> ถึง <strong>{endDate || '-'}</strong> ({stats.dayCount} วันทำการ)
          </span>
          <span>จำนวนบิลทั้งหมดในช่วงนี้: <strong>{stats.totalTickets} บิล</strong></span>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Concrete Cues */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium flex items-center justify-between">
            <span>คอนกรีตขายออก</span>
            <PackageCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats.totalConcreteCues.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
            <span>{stats.totalTrips} เที่ยว</span>
          </div>
        </div>

        {/* Card 2: Average cues/day */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium flex items-center justify-between">
            <span>เฉลี่ยต่อวัน</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats.avgCuesPerDay.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            คิว / วัน ({stats.dayCount} วัน)
          </div>
        </div>

        {/* Card 3: Raw Materials */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium flex items-center justify-between">
            <span>วัตถุดิบรับเข้า</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats.rawMaterialTons.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </div>
          <div className="text-[11px] text-blue-700 font-medium mt-1">
            ตัน (หิน/ทราย/ปูน)
          </div>
        </div>

        {/* Card 4: Total Tickets */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium flex items-center justify-between">
            <span>บิลตาชั่งทั้งหมด</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats.totalTickets}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            รายการชั่งน้ำหนัก
          </div>
        </div>

        {/* Card 5: Est Commission */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-slate-500 text-xs font-medium flex items-center justify-between">
            <span>ค่าคอมมิชชั่น</span>
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            ฿{Math.round(stats.totalCommission).toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            ประมาณการเบื้องต้น
          </div>
        </div>

        {/* Card 6: Audit Needs */}
        <div
          onClick={onNavigateToRawAudit}
          className={`bg-white rounded-2xl p-4 border shadow-xs cursor-pointer transition ${
            stats.auditCount > 0
              ? 'border-rose-300 hover:border-rose-400 bg-rose-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-slate-500 text-xs font-medium flex items-center justify-between">
            <span>ต้องตรวจสอบ</span>
            {stats.auditCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold mt-2 font-mono ${
              stats.auditCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {stats.auditCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{stats.auditCount > 0 ? 'คลิกดูรายการผิดปกติ' : 'ข้อมูลครบถ้วน'}</span>
            <ArrowUpRight className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Daily Volume Bar Chart */}
      {dailyTrends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                ปริมาณคอนกรีตขายออกรายวัน (คิว)
              </h3>
              <p className="text-xs text-slate-500">
                คลิกที่แท่งกราฟของวันนั้นๆ เพื่อเจาะลึกดูรายงานบิลประจำวัน (ไฟล์ 004)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span>
                คิวคอนกรีต
              </span>
              <span className="text-slate-400">
                เฉลี่ย {stats.avgCuesPerDay.toFixed(1)} คิว/วัน
              </span>
            </div>
          </div>

          <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
            {dailyTrends.map((d) => {
              const heightPercent = maxDailyCues > 0 ? (d.cues / maxDailyCues) * 100 : 0;
              const dateParts = d.date.split('-');
              const shortDate = `${dateParts[2]}/${dateParts[1]}`;

              return (
                <div
                  key={d.date}
                  onClick={() => onNavigateToDaily(d.date)}
                  className="flex-1 min-w-[30px] sm:min-w-[40px] flex flex-col items-center group cursor-pointer"
                  title={`${d.date}: ${d.cues.toFixed(1)} คิว (${d.trips} เที่ยว)`}
                >
                  <div className="text-[10px] text-slate-500 font-medium mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {d.cues.toFixed(0)}
                  </div>
                  <div className="w-full bg-slate-100 rounded-t-sm h-32 flex items-end">
                    <div
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                      className="w-full bg-amber-500 hover:bg-amber-600 rounded-t-sm transition-all duration-200 relative"
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium mt-1.5">
                    {shortDate}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Plant Daily Standard Summary (ตารางสรุปมาตรฐานโรงงาน: ทะเบียนรถ & เกรดคอนกรีต) */}
      <PlantSummaryReport
        tickets={filteredTickets}
        truckSettings={settings?.trucks || defaultSettings.trucks}
        selectedDate={startDate === endDate ? startDate : `${startDate} ถึง ${endDate}`}
        availableDates={availableDates}
        onSelectDate={(d) => {
          setStartDate(d);
          setEndDate(d);
        }}
      />

      {/* 2-Column Split: สรุปตามทะเบียนรถ vs สรุปตามพนักงานขับรถ (แยกส่วนกันตามคำขอ) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: สรุปตามทะเบียนรถ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                <span>สรุปตามทะเบียนรถ (คันรถ)</span>
              </h3>
              <p className="text-xs text-slate-500">
                สรุปยอดส่งคอนกรีตเฉพาะรถที่มีในระบบ (ตารางรถในตั้งค่าระบบ)
              </p>
            </div>
            <span className="text-xs font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
              {truckBreakdown.length} คัน
            </span>
          </div>

          <div className="space-y-3">
            {truckBreakdown.map((trk, idx) => {
              const maxCue = truckBreakdown[0]?.cues || 1;
              const percent = (trk.cues / maxCue) * 100;
              const totalConcrete = stats.totalConcreteCues || 1;
              const share = ((trk.cues / totalConcrete) * 100).toFixed(1);

              return (
                <div key={trk.plateNumber + idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 font-mono">{trk.plateNumber}</span>
                      <span className="text-xs text-slate-600 font-medium">
                        {trk.truckNumber && trk.truckNumber !== '-' ? `(เบอร์ ${trk.truckNumber})` : ''}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                        {trk.truckType}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 font-mono">
                        {trk.cues.toFixed(1)} คิว
                      </span>
                      <span className="text-xs text-slate-500 ml-2">({trk.trips} เที่ยว)</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className="bg-amber-600 h-full rounded-full transition-all duration-300"
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                    <span>ส่วนแบ่งยอดส่ง</span>
                    <span className="font-semibold text-slate-700 font-mono">{share}%</span>
                  </div>
                </div>
              );
            })}

            {truckBreakdown.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                ไม่มีข้อมูลคันรถคอนกรีตในระบบ (ตารางรถ) ที่มีการส่งงานในช่วงวันที่เลือก
              </div>
            )}
          </div>
        </motion.div>

        {/* Section 2: สรุปตามพนักงานขับรถ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <span>สรุปตามพนักงานขับรถ</span>
              </h3>
              <p className="text-xs text-slate-500">
                สรุปยอดส่งคอนกรีตและค่าคอมมิชชั่นประมาณการรายบุคคล
              </p>
            </div>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
              {driverBreakdown.length} คน
            </span>
          </div>

          <div className="space-y-3">
            {driverBreakdown.map((drv, idx) => {
              const maxCue = driverBreakdown[0]?.cues || 1;
              const percent = (drv.cues / maxCue) * 100;

              return (
                <div key={drv.driverName + idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-900">{drv.driverName}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 font-mono">
                        {drv.cues.toFixed(1)} คิว
                      </span>
                      <span className="text-xs text-slate-500 ml-2">({drv.trips} เที่ยว)</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                    <span>ค่าคอมประมาณการ</span>
                    <span className="font-bold text-emerald-800 font-mono">
                      ฿{Math.round(drv.commission).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}

            {driverBreakdown.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                ไม่มีข้อมูลพนักงานขับรถในช่วงวันที่เลือก
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Concrete Grades, Other Product Sales & Raw Materials Breakdown Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Concrete Grades Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
        >
          <div className="mb-3">
            <h3 className="font-semibold text-slate-900 text-base">
              สัดส่วนเกรดคอนกรีต (Strength Mix)
            </h3>
            <span className="text-xs text-slate-500 font-mono mt-1 inline-block">2,350 กก./คิว</span>
          </div>

          <div className="space-y-2.5">
            {gradeBreakdown.slice(0, 8).map((g) => {
              const totalCues = stats.totalConcreteCues || 1;
              const pct = ((g.cues / totalCues) * 100).toFixed(1);
              return (
                <div key={g.grade} className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-medium text-slate-800">{g.grade}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs">{g.trips} เที่ยว</span>
                    <span className="font-semibold text-slate-900 min-w-[70px] text-right font-mono">
                      {g.cues.toFixed(1)} คิว
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Other (non-concrete) Product Sales */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
        >
          <div className="mb-3">
            <h3 className="font-semibold text-slate-900 text-base">
              ยอดขายสินค้าอื่นๆ (นอกเหนือคอนกรีต)
            </h3>
            <span className="text-xs text-emerald-700 font-medium mt-1 inline-block">
              รวม ฿{Math.round(otherSalesTotalAmount).toLocaleString()}
            </span>
          </div>

          <div className="space-y-2">
            {otherSalesBreakdown.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs sm:text-sm p-2 rounded-lg bg-slate-50 gap-2"
              >
                <span className="font-medium text-slate-800 truncate">{item.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500">{item.trips} เที่ยว</span>
                  <span className="font-semibold text-slate-900 font-mono whitespace-nowrap">
                    {item.quantity.toLocaleString(undefined, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{' '}
                    {item.unit}
                  </span>
                  {item.amount > 0 && (
                    <span className="font-bold text-emerald-800 font-mono whitespace-nowrap">
                      ฿{Math.round(item.amount).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {otherSalesBreakdown.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                ไม่มีรายการขายสินค้าอื่นๆ (นอกเหนือคอนกรีต) ในช่วงวันที่เลือก
              </div>
            )}
          </div>
        </motion.div>

        {/* Raw Materials Received */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
        >
          <div className="mb-3">
            <h3 className="font-semibold text-slate-900 text-base">
              วัตถุดิบรับเข้าโรงงาน (Raw Materials)
            </h3>
            <span className="text-xs text-blue-700 font-medium mt-1 inline-block">รวม {stats.rawMaterialTons.toFixed(1)} ตัน</span>
          </div>

          <div className="space-y-2">
            {rawBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs sm:text-sm p-2 rounded-lg bg-slate-50">
                <span className="font-medium text-slate-800">{item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{item.trips} คัน</span>
                  <span className="font-bold text-blue-900 font-mono">
                    {item.tons.toFixed(1)} ตัน
                  </span>
                </div>
              </div>
            ))}

            {rawBreakdown.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                ไม่มีรายการรับเข้าวัตถุดิบในช่วงวันที่เลือก
              </div>
            )}
          </div>
        </motion.div>
      </div>
      </div>

      {/* 1-Page Summary Export & Print Modal */}
      <DashboardOnePageModal
        isOpen={is1PageModalOpen}
        onClose={() => setIs1PageModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
        stats={{
          ...stats,
          auditCount: stats.auditCount,
        }}
        topProducts={topProductsForExport}
        driverStats={driverStatsForExport}
        dailyTrends={dailyTrends}
        onExportExcel={handleExport1PageExcel}
      />
    </div>
  );
};
