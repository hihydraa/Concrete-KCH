import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
  UserCheck,
  Layers,
  FileSpreadsheet,
  Search,
  Trash2,
} from 'lucide-react';
import { WeighTicket, PlantSettings } from '../types';
import { exportDailyBillsToExcel } from '../utils/excelParser';
import { PlantSummaryReport } from './PlantSummaryReport';
import { defaultSettings } from '../data/masterSettings';

interface DailyBillsTabProps {
  tickets: WeighTicket[];
  settings?: PlantSettings;
  initialDate?: string;
  onEditTicket?: (ticket: WeighTicket) => void;
  onDeleteTicket?: (ticket: WeighTicket) => void;
}

export const DailyBillsTab: React.FC<DailyBillsTabProps> = ({
  tickets,
  settings = defaultSettings,
  initialDate,
  onEditTicket,
  onDeleteTicket,
}) => {
  // Search by ticket number (เลขที่ใบชั่ง)
  const [searchTerm, setSearchTerm] = useState('');

  // Available distinct dates
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

  // Start Date and End Date - Default to "วันนี้" (presets.today) as required
  const [startDate, setStartDate] = useState<string>(
    initialDate || (availableDates.length > 0 ? availableDates[availableDates.length - 1] : '')
  );
  const [endDate, setEndDate] = useState<string>(
    initialDate || (availableDates.length > 0 ? availableDates[availableDates.length - 1] : '')
  );

  // Sync if initialDate changes or when availableDates changes
  useEffect(() => {
    if (initialDate && availableDates.includes(initialDate)) {
      setStartDate(initialDate);
      setEndDate(initialDate);
    } else if (availableDates.length > 0 && (!startDate || !availableDates.includes(startDate))) {
      const latest = availableDates[availableDates.length - 1];
      setStartDate(latest);
      setEndDate(latest);
    }
  }, [initialDate, availableDates]);

  // Preset click handlers
  const applyPreset = (range: [string, string]) => {
    setStartDate(range[0]);
    setEndDate(range[1]);
  };

  const isPresetActive = (range: [string, string]) => {
    return startDate === range[0] && endDate === range[1];
  };

  // Filtered tickets in the selected range
  const rangeTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        if (!t.dateIn) return false;
        if (startDate && t.dateIn < startDate) return false;
        if (endDate && t.dateIn > endDate) return false;
        return true;
      })
      .sort((a, b) => {
        const dateComp = a.dateIn.localeCompare(b.dateIn);
        if (dateComp !== 0) return dateComp;
        return a.timeIn.localeCompare(b.timeIn);
      });
  }, [tickets, startDate, endDate]);

  // 1. Summary by Truck for the range (NO driver name included, as requested)
  const truckSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        truckNumber: string;
        plateNumber: string;
        truckType: string;
        cues: number;
        trips: number;
      }
    >();

    rangeTickets
      .filter((t) => t.isConcrete)
      .forEach((t) => {
        const key = t.truckNumber || t.plateNumber || 'ไม่ระบุ';
        const existing = map.get(key) || {
          truckNumber: t.truckNumber || '-',
          plateNumber: t.plateNumber || '-',
          truckType: t.truckType || 'โม่',
          cues: 0,
          trips: 0,
        };
        existing.cues += t.quantity;
        existing.trips += 1;
        map.set(key, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.cues - a.cues);
  }, [rangeTickets]);

  // 2. Summary by Driver for the range (Added as requested)
  const driverSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        driverName: string;
        cues: number;
        trips: number;
      }
    >();

    rangeTickets
      .filter((t) => t.isConcrete)
      .forEach((t) => {
        const key = t.driverName || 'ไม่ระบุคนขับ';
        const existing = map.get(key) || {
          driverName: key,
          cues: 0,
          trips: 0,
        };
        existing.cues += t.quantity;
        existing.trips += 1;
        map.set(key, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.cues - a.cues);
  }, [rangeTickets]);

  // 3. Summary by Grade for the range
  const gradeSummary = useMemo(() => {
    const map = new Map<string, { grade: string; cues: number; trips: number }>();
    rangeTickets
      .filter((t) => t.isConcrete)
      .forEach((t) => {
        const grade = t.productName || 'ไม่ระบุเกรด';
        const existing = map.get(grade) || { grade, cues: 0, trips: 0 };
        existing.cues += t.quantity;
        existing.trips += 1;
        map.set(grade, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.cues - a.cues);
  }, [rangeTickets]);

  // Total Cues & Diff
  const totalTruckCues = useMemo(
    () => truckSummary.reduce((sum, t) => sum + t.cues, 0),
    [truckSummary]
  );
  const totalDriverCues = useMemo(
    () => driverSummary.reduce((sum, d) => sum + d.cues, 0),
    [driverSummary]
  );
  const totalGradeCues = useMemo(
    () => gradeSummary.reduce((sum, g) => sum + g.cues, 0),
    [gradeSummary]
  );
  const diffCues = Math.round((totalTruckCues - totalGradeCues) * 100) / 100;

  // KPIs
  const rangeStats = useMemo(() => {
    const concreteTickets = rangeTickets.filter((t) => t.isConcrete);
    const rawInTickets = rangeTickets.filter((t) => t.direction === 'in');
    const rawTons = rawInTickets.reduce((sum, t) => sum + t.weightNet / 1000, 0);

    return {
      totalTickets: rangeTickets.length,
      concreteCues: totalTruckCues,
      concreteTrips: concreteTickets.length,
      rawTons,
    };
  }, [rangeTickets, totalTruckCues]);

  const selectedDayCount = useMemo(
    () => new Set(rangeTickets.map((t) => t.dateIn).filter(Boolean)).size,
    [rangeTickets]
  );

  // Ticket list shown in the table, narrowed by ticket number search
  // (summary cards above stay based on the full date-range selection)
  const displayedTickets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rangeTickets;
    return rangeTickets.filter((t) => t.ticketNumber.toLowerCase().includes(q));
  }, [rangeTickets, searchTerm]);

  const dateLabel = startDate === endDate ? startDate : `${startDate} ถึง ${endDate}`;

  const handleExportExcel = () => {
    exportDailyBillsToExcel(
      dateLabel,
      rangeTickets,
      truckSummary,
      gradeSummary,
      diffCues,
      driverSummary
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Date Range Switcher */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs print:border-none print:shadow-none print:p-0 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                สรุปบิลประจำวัน
              </span>
              <span className="text-xs text-slate-500">
                รายงานบิลตาชั่งและสรุปแยกตามคันรถ / คนขับ / เกรด (แยกชีทรายวัน)
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              สรุปบิลประจำวัน: {dateLabel || 'ทุกช่วงวันที่'}
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              id="btn-export-daily-excel"
              onClick={handleExportExcel}
              title={
                selectedDayCount > 1
                  ? `Export Excel โดยแบ่งข้อมูลเป็น ${selectedDayCount} ชีทรายวัน พร้อมชีทสรุปภาพรวม`
                  : 'Export Excel สรุปบิลประจำวัน'
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {selectedDayCount > 1
                  ? `Export Excel (แยก ${selectedDayCount} ชีทรายวัน)`
                  : 'Export Excel (ชีทรายวัน)'}
              </span>
            </button>

            <button
              id="btn-print-daily"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-200 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Preset Bar (Default is วันนี้) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100 print:hidden">
          {/* Custom Date Range Picker */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-800">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>เลือกช่วงวันที่:</span>
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

          {/* Quick Presets: วันนี้ (Default), 3 วันล่าสุด, 7 วันล่าสุด, เดือนนี้ (MTD), ทั้งหมด */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1">เลือกเร็ว:</span>
            <button
              onClick={() => applyPreset(presets.today)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.today)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              วันนี้
            </button>
            <button
              onClick={() => applyPreset(presets.last3)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.last3)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              3 วันล่าสุด
            </button>
            <button
              onClick={() => applyPreset(presets.last7)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.last7)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              7 วันล่าสุด
            </button>
            <button
              onClick={() => applyPreset(presets.mtd)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.mtd)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              เดือนนี้ (MTD)
            </button>
            <button
              onClick={() => applyPreset(presets.all)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isPresetActive(presets.all)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด
            </button>
          </div>
        </div>

        {/* Range KPI quick banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs sm:text-sm">
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-500 block text-xs">บิลทั้งหมดในช่วงนี้</span>
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {rangeStats.totalTickets} บิล
            </span>
          </div>
          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
            <span className="text-amber-800 block text-xs">คิวคอนกรีตขายออก</span>
            <span className="text-base sm:text-lg font-bold text-amber-900 font-mono">
              {rangeStats.concreteCues.toFixed(1)} คิว
            </span>
            <span className="text-[11px] text-amber-700 ml-1">({rangeStats.concreteTrips} เที่ยว)</span>
          </div>
          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-200/60">
            <span className="text-blue-800 block text-xs">วัตถุดิบรับเข้า (หิน/ทราย/ปูน)</span>
            <span className="text-base sm:text-lg font-bold text-blue-900 font-mono">
              {rangeStats.rawTons.toFixed(1)} ตัน
            </span>
          </div>
          <div
            className={`p-2.5 rounded-xl border ${
              diffCues === 0
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                : 'bg-rose-50/60 border-rose-200 text-rose-800'
            }`}
          >
            <span className="block text-xs font-medium">ตรวจผลต่าง คันรถ vs เกรด</span>
            <div className="text-base sm:text-lg font-bold font-mono flex items-center gap-1.5">
              {diffCues === 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>0.00 คิว (ตรงกัน)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>{diffCues.toFixed(2)} คิว</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ตารางสรุปมาตรฐานโรงงาน: ทะเบียนรถ & เกรดคอนกรีต (Plant Daily Standard Summary) */}
      <PlantSummaryReport
        tickets={rangeTickets}
        truckSettings={settings.trucks}
        selectedDate={startDate === endDate ? startDate : `${startDate} ถึง ${endDate}`}
        availableDates={availableDates}
        onSelectDate={(d) => {
          setStartDate(d);
          setEndDate(d);
        }}
      />

      {/* Main Tickets Table with Separate Truck Number & Driver Columns */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
              รายการบิลตาชั่ง ({displayedTickets.length} รายการ)
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 print:hidden">
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาเลขที่ใบชั่ง..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              คลิกที่แถวเพื่อแก้ไขคนขับด้วยตนเอง
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="py-2.5 px-3">ลำดับ</th>
                <th className="py-2.5 px-3">วันที่</th>
                <th className="py-2.5 px-3">เลขที่ใบชั่ง</th>
                <th className="py-2.5 px-3">เวลา</th>
                <th className="py-2.5 px-3">ทะเบียนรถ</th>
                {/* Separate Columns as requested */}
                <th className="py-2.5 px-3">เบอร์รถ</th>
                <th className="py-2.5 px-3">พนักงานขับรถ</th>
                <th className="py-2.5 px-3">ลูกค้า / หน่วยงาน</th>
                <th className="py-2.5 px-3">สินค้า / เกรด</th>
                <th className="py-2.5 px-3 text-right">นน.สุทธิ (กก.)</th>
                <th className="py-2.5 px-3 text-right">จำนวน</th>
                <th className="py-2.5 px-3">ผู้ขนส่ง</th>
                <th className="py-2.5 px-3 text-center">จับคู่</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedTickets.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-400">
                    {searchTerm.trim()
                      ? `ไม่พบเลขที่ใบชั่งที่ตรงกับ "${searchTerm}"`
                      : 'ไม่มีรายการในช่วงวันที่เลือก'}
                  </td>
                </tr>
              ) : (
                displayedTickets.map((t, idx) => (
                  <tr
                    key={t.ticketNumber || idx}
                    onClick={() => onEditTicket && onEditTicket(t)}
                    className="hover:bg-slate-50/80 transition cursor-pointer"
                  >
                    <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono whitespace-nowrap text-xs">
                      {t.dateIn}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-900">
                      {t.ticketNumber}
                    </td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap text-xs">
                      {t.timeIn} - {t.timeOut}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-slate-800">
                      {t.plateNumber}
                    </td>
                    {/* Separate Column: เบอร์รถ */}
                    <td className="py-2 px-3">
                      <span className="font-semibold text-slate-900">
                        {t.truckNumber && t.truckNumber !== '-' ? `เบอร์ ${t.truckNumber}` : '-'}
                      </span>
                    </td>
                    {/* Separate Column: พนักงานขับรถ */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">
                          {t.driverName || (
                            <span className="text-slate-400 italic">(ไม่ระบุ)</span>
                          )}
                        </span>
                        {t.matchedBy === 'manual' && (
                          <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0.5 rounded border border-purple-200">
                            แก้ไข
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 max-w-[200px] truncate text-slate-800">
                      {t.customerName || (
                        <span className="text-rose-500 font-medium italic">
                          (ไม่ระบุลูกค้า)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 max-w-[200px] truncate">
                      <span
                        className={`font-medium ${
                          t.isConcrete ? 'text-amber-900 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        {t.productName || (
                          <span className="text-rose-500 font-medium italic">
                            (ไม่ระบุสินค้า)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {t.weightNet.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <span className="font-bold text-slate-900 font-mono">
                        {t.quantity.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </span>{' '}
                      <span className="text-xs text-slate-500">{t.quantityUnit}</span>
                      {t.isQuantityOverridden && (
                        <span
                          className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded font-semibold"
                          title="จำนวนคิวกำหนดเอง"
                        >
                          แก้คิว
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-xs">
                      {t.carrierCode || '-'}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          t.matchedBy === 'manual'
                            ? 'bg-purple-100 text-purple-800'
                            : t.matchedBy === 'driver'
                            ? 'bg-blue-100 text-blue-800'
                            : t.matchedBy === 'code'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.matchedBy === 'plate'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                        title={
                          t.matchedBy === 'manual'
                            ? 'ระบุคนขับด้วยตนเอง'
                            : t.matchedBy === 'driver'
                            ? 'ระบุจากคอลัมน์คนขับในไฟล์ตาชั่ง'
                            : t.matchedBy === 'code'
                            ? 'จับคู่จากรหัสผู้ขนส่ง'
                            : t.matchedBy === 'plate'
                            ? 'ค่าสำรองจากทะเบียนรถประจำ (คนขับอาจสลับคัน)'
                            : 'ไม่พบข้อมูล'
                        }
                      >
                        {t.matchedBy === 'manual'
                          ? '✏️ แก้ไข'
                          : t.matchedBy === 'driver'
                          ? 'คนขับ*'
                          : t.matchedBy === 'code'
                          ? 'รหัส'
                          : t.matchedBy === 'plate'
                          ? 'ทะเบียน'
                          : 'ไม่พบ'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTicket && onDeleteTicket(t);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                        title="ลบใบชั่งนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Summary Blocks (Section 3.3 - File 004 structure) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Block 1: สรุปคิวคอนกรีตแยกตามคันรถ (ไม่มีชื่อพนักงานขับรถ ตามคำขอ) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-600" />
              <span>สรุปคิวคอนกรีตแยกตามคันรถ</span>
            </h4>
            <span className="text-xs text-slate-500">
              รวม {truckSummary.length} คัน
            </span>
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            {truckSummary.map((trk) => (
              <div
                key={trk.truckNumber + trk.plateNumber}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {trk.truckNumber && trk.truckNumber !== '-' ? `เบอร์ ${trk.truckNumber} ` : ''}
                    <span className="font-mono text-slate-700">({trk.plateNumber})</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{trk.truckType}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 font-mono">{trk.cues.toFixed(1)} คิว</div>
                  <div className="text-[11px] text-slate-500">{trk.trips} เที่ยว</div>
                </div>
              </div>
            ))}

            {truckSummary.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                ไม่มีข้อมูลคันรถคอนกรีตในช่วงนี้
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900 text-sm">
            <span>รวมคิวคอนกรีต (ตามคันรถ):</span>
            <span className="text-amber-900 font-mono">{totalTruckCues.toFixed(1)} คิว</span>
          </div>
        </div>

        {/* Block 2: สรุปคิวคอนกรีตแยกตามพนักงานขับรถ (เพิ่มใหม่ตามคำขอ) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>สรุปคิวคอนกรีตแยกตามคนขับ</span>
            </h4>
            <span className="text-xs text-slate-500">
              รวม {driverSummary.length} คน
            </span>
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            {driverSummary.map((drv) => (
              <div
                key={drv.driverName}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {drv.driverName}
                  </div>
                  <div className="text-[11px] text-slate-500">พนักงานขับรถ</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 font-mono">{drv.cues.toFixed(1)} คิว</div>
                  <div className="text-[11px] text-slate-500">{drv.trips} เที่ยว</div>
                </div>
              </div>
            ))}

            {driverSummary.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                ไม่มีข้อมูลคนขับคอนกรีตในช่วงนี้
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900 text-sm">
            <span>รวมคิวคอนกรีต (ตามคนขับ):</span>
            <span className="text-emerald-900 font-mono">{totalDriverCues.toFixed(1)} คิว</span>
          </div>
        </div>

        {/* Block 3: สรุปคิวคอนกรีตแยกตามเกรด */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>สรุปคิวคอนกรีตแยกตามเกรด</span>
            </h4>
            <span className="text-xs text-slate-500">
              รวม {gradeSummary.length} เกรด
            </span>
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            {gradeSummary.map((g) => (
              <div
                key={g.grade}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50"
              >
                <span className="font-medium text-slate-800">{g.grade}</span>
                <div className="text-right">
                  <span className="font-bold text-slate-900 font-mono">{g.cues.toFixed(1)} คิว</span>
                  <span className="text-[11px] text-slate-500 ml-2">({g.trips} เที่ยว)</span>
                </div>
              </div>
            ))}

            {gradeSummary.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs">
                ไม่มีข้อมูลเกรดคอนกรีตในช่วงนี้
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900 text-sm">
            <span>รวมคิวคอนกรีต (ตามเกรด):</span>
            <span className="text-amber-900 font-mono">{totalGradeCues.toFixed(1)} คิว</span>
          </div>
        </div>
      </div>
    </div>
  );
};
