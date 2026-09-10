import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coins,
  Truck,
  Download,
  Printer,
  ChevronRight,
  ChevronDown,
  User,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { DriverSummary, PlantSettings, WeighTicket } from '../types';
import { exportDriverCommissionToExcel } from '../utils/excelParser';
import { cleanDriverName } from '../utils/textNormalizer';

interface CommissionTabProps {
  tickets: WeighTicket[];
  settings: PlantSettings;
}

export const CommissionTab: React.FC<CommissionTabProps> = ({ tickets, settings }) => {
  const [selectedDriverName, setSelectedDriverName] = useState<string | null>(null);

  // Available dates in dataset
  const availableDates = useMemo(() => {
    return Array.from(new Set(tickets.map((t) => t.dateIn))).filter(Boolean).sort();
  }, [tickets]);

  const minDate = availableDates[0] || '';
  const maxDate = availableDates[availableDates.length - 1] || '';

  // Date range filter state (empty string = no filter / all)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (availableDates.length > 0) {
      if (startDate && (startDate < minDate || startDate > maxDate)) {
        setStartDate('');
      }
      if (endDate && (endDate < minDate || endDate > maxDate)) {
        setEndDate('');
      }
    }
  }, [availableDates, minDate, maxDate, startDate, endDate]);

  // Quick preset helper
  const handleApplyPreset = (preset: 'all' | 'today' | '3days' | '7days' | 'month') => {
    if (preset === 'all' || !maxDate) {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'today') {
      setStartDate(maxDate);
      setEndDate(maxDate);
      return;
    }

    if (preset === '3days') {
      const idx = availableDates.indexOf(maxDate);
      const startIdx = Math.max(0, idx - 2);
      setStartDate(availableDates[startIdx] || maxDate);
      setEndDate(maxDate);
      return;
    }

    if (preset === '7days') {
      const idx = availableDates.indexOf(maxDate);
      const startIdx = Math.max(0, idx - 6);
      setStartDate(availableDates[startIdx] || maxDate);
      setEndDate(maxDate);
      return;
    }

    if (preset === 'month') {
      const monthPrefix = maxDate.substring(0, 7); // e.g. "2026-08"
      const monthDates = availableDates.filter((d) => d.startsWith(monthPrefix));
      if (monthDates.length > 0) {
        setStartDate(monthDates[0]);
        setEndDate(monthDates[monthDates.length - 1]);
      } else {
        setStartDate(`${monthPrefix}-01`);
        setEndDate(maxDate);
      }
    }
  };

  // Filtered tickets based on selected date range
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (startDate && t.dateIn < startDate) return false;
      if (endDate && t.dateIn > endDate) return false;
      return true;
    });
  }, [tickets, startDate, endDate]);

  // Group tickets by driver to produce driver summaries within the filtered date range
  // วิธีการคิด "ค่าคอมมิชชั่นรายบุคคล":
  // คำนวณจากค่าหลัก คือจาก "รหัสผู้ขนส่ง" ในไฟล์ที่นำเข้า
  // เนื่องจาก พนักงานขับรถ 1 คน อาจขับรถหลายคัน ดังนั้นการตั้งต้นด้วย ทะเบียนรถจึงไม่ถูกต้อง
  const driverSummaries: DriverSummary[] = useMemo(() => {
    const map = new Map<string, DriverSummary>();

    // 1. รวมรายชื่อคนขับทั้งหมดจาก Master Settings (ทั้งตารางรหัสผู้ขนส่ง carrierDrivers และตารางรถ trucks)
    const knownDrivers = new Set<string>();
    (settings.carrierDrivers || []).forEach((cd) => {
      const n = (cd.driverName || '').trim();
      if (n) knownDrivers.add(n);
    });
    (settings.trucks || []).forEach((t) => {
      const n = (t.driverName || '').trim();
      if (n) knownDrivers.add(n);
    });

    knownDrivers.forEach((drvName) => {
      const cdConfig = (settings.carrierDrivers || []).find(
        (cd) => cleanDriverName(cd.driverName) === cleanDriverName(drvName)
      );
      const trkConfig = (settings.trucks || []).find(
        (t) => cleanDriverName(t.driverName) === cleanDriverName(drvName)
      );

      map.set(drvName, {
        driverName: drvName,
        carrierCode: cdConfig?.carrierCode || trkConfig?.carrierCode || '',
        truckNumber: trkConfig?.truckNumber || '-',
        plateNumber: trkConfig?.plateNumber || '-',
        truckType: trkConfig?.truckType || 'โม่',
        trucksDriven: [],
        commissionType: trkConfig?.commissionType || 'per_cue',
        commissionRate: trkConfig?.commissionRate || 9.0,
        totalTrips: 0,
        totalCues: 0,
        totalWeightTon: 0,
        totalCommission: 0,
        matchedFromCodeCount: 0,
        matchedFromPlateCount: 0,
        dailyTrips: [],
      });
    });

    // 2. เติมข้อมูลเที่ยววิ่งจาก filteredTickets โดยระบุคนขับตาม "รหัสผู้ขนส่ง" เป็นหลัก
    filteredTickets.forEach((t) => {
      const drvName = (t.driverName || '').trim() || 'ไม่ระบุ';
      if (!map.has(drvName)) {
        map.set(drvName, {
          driverName: drvName,
          carrierCode: t.carrierCode || '',
          truckNumber: t.truckNumber || '-',
          plateNumber: t.plateNumber || '-',
          truckType: t.truckType || 'อื่นๆ',
          trucksDriven: [],
          commissionType: t.commissionType || (t.isConcrete ? 'per_cue' : 'per_trip'),
          commissionRate: t.commissionRate || (t.isConcrete ? 9.0 : 80),
          totalTrips: 0,
          totalCues: 0,
          totalWeightTon: 0,
          totalCommission: 0,
          matchedFromCodeCount: 0,
          matchedFromPlateCount: 0,
          dailyTrips: [],
        });
      }

      const summary = map.get(drvName)!;
      if (!summary.carrierCode && t.carrierCode && t.carrierCode !== '-') {
        summary.carrierCode = t.carrierCode;
      }
      if (t.countTrip) summary.totalTrips += 1;
      if (t.isConcrete) summary.totalCues += t.quantity;
      summary.totalWeightTon += t.weightNet / 1000;
      summary.totalCommission += t.commission;

      if (t.matchedBy === 'code') summary.matchedFromCodeCount += 1;
      if (t.matchedBy === 'plate') summary.matchedFromPlateCount += 1;

      // บันทึกทะเบียนรถที่คนขับคนนี้ขับวิ่งจริง (อาจขับหลายคัน)
      if (t.plateNumber && !summary.trucksDriven?.includes(t.plateNumber)) {
        if (!summary.trucksDriven) summary.trucksDriven = [];
        summary.trucksDriven.push(t.plateNumber);
      }
    });

    // 3. สร้างรายละเอียดการวิ่ง (dailyTrips) เรียงลำดับตามวันที่และเวลา
    map.forEach((summary) => {
      const drvTickets = filteredTickets
        .filter((t) => ((t.driverName || '').trim() || 'ไม่ระบุ') === summary.driverName && t.countTrip)
        .sort((a, b) => {
          const c = a.dateIn.localeCompare(b.dateIn);
          if (c !== 0) return c;
          return a.timeIn.localeCompare(b.timeIn);
        });

      let cumulativeTrip = 0;
      let cumulativeCues = 0;
      let currentDate = '';
      let dailyTripIndex = 0;

      summary.dailyTrips = drvTickets.map((t) => {
        if (t.dateIn !== currentDate) {
          currentDate = t.dateIn;
          dailyTripIndex = 1;
        } else {
          dailyTripIndex += 1;
        }

        cumulativeTrip += 1;
        cumulativeCues += t.quantity;

        return {
          date: t.dateIn,
          tripIndex: dailyTripIndex,
          cumulativeTrip,
          destination: t.customerName || 'ไม่ระบุปลายทาง',
          grade: t.productName || 'ไม่ระบุเกรด',
          cues: t.quantity,
          cumulativeCues: Math.round(cumulativeCues * 10) / 10,
          commission: t.commission,
          ticketNumber: t.ticketNumber,
          timeOut: t.timeOut,
          plateNumber: t.plateNumber || '-', // ทะเบียนรถของเที่ยวนี้
          truckNumber: t.truckNumber || '-', // เบอร์รถ
          truckType: t.truckType || '-',     // ประเภทรถ
        };
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalCues - a.totalCues);
  }, [filteredTickets, settings]);

  const activeDriver = useMemo(() => {
    if (!selectedDriverName) return driverSummaries[0] || null;
    return driverSummaries.find((d) => d.driverName === selectedDriverName) || driverSummaries[0] || null;
  }, [driverSummaries, selectedDriverName]);

  const totalAllCommission = useMemo(() => {
    return driverSummaries.reduce((sum, d) => sum + d.totalCommission, 0);
  }, [driverSummaries]);

  const totalAllCues = useMemo(() => {
    return driverSummaries.reduce((sum, d) => sum + d.totalCues, 0);
  }, [driverSummaries]);

  const totalAllTrips = useMemo(() => {
    return driverSummaries.reduce((sum, d) => sum + d.totalTrips, 0);
  }, [driverSummaries]);

  const activeDriversCount = useMemo(() => {
    return driverSummaries.filter((d) => d.totalTrips > 0).length;
  }, [driverSummaries]);

  const handleExportExcel = () => {
    const rangeLabel =
      startDate && endDate
        ? `${startDate}_ถึง_${endDate}`
        : availableDates.length > 0
        ? `${availableDates[0]}_ถึง_${availableDates[availableDates.length - 1]}`
        : 'ทั้งหมด';
    exportDriverCommissionToExcel(driverSummaries, rangeLabel);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                ค่าคอมมิชชั่นรายบุคคล (คำนวณตามรหัสผู้ขนส่ง)
              </span>
              <span className="text-xs text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                ⚠️ ยึดตามรหัสผู้ขนส่ง/คนขับเป็นหลัก
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              ค่าคอมมิชชั่นรายบุคคล
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              สรุปเที่ยววิ่ง คิวคอนกรีต และค่าคอมมิชชั่นของพนักงานขับรถแต่ละคนตามช่วงเวลาที่กำหนด
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              id="btn-export-commission-excel"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium shadow-xs transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export .xlsx (แยกชีทรายคน)</span>
            </button>

            <button
              id="btn-print-commission"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium border border-slate-200 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
        </div>

        {/* Date Range Filter Section */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 print:hidden space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                กรองช่วงเวลาในการดูข้อมูล (วันที่เริ่มต้น - สิ้นสุด):
              </span>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <span>กำลังแสดง:</span>
              <span className="font-semibold text-slate-800">
                {startDate ? startDate : minDate || '-'} ถึง {endDate ? endDate : maxDate || '-'}
              </span>
              <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-medium text-[11px]">
                {filteredTickets.length} บิล ({activeDriversCount} คนขับมีเที่ยววิ่ง)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Start Date */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-600 font-medium">เริ่มต้น:</label>
              <input
                type="date"
                value={startDate}
                min={minDate}
                max={endDate || maxDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-600 font-medium">สิ้นสุด:</label>
              <input
                type="date"
                value={endDate}
                min={startDate || minDate}
                max={maxDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => handleApplyPreset('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  !startDate && !endDate
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                ทั้งหมด
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('today')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  startDate === maxDate && endDate === maxDate && maxDate !== ''
                    ? 'bg-amber-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                วันล่าสุด
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('3days')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ย้อนหลัง 3 วัน
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('7days')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ย้อนหลัง 7 วัน
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('month')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                ทั้งเดือน
              </button>
            </div>
          </div>
        </div>

        {/* Critical Operational Notice Banner */}
        <div className="mt-4 p-4 rounded-xl bg-amber-50/90 border border-amber-300 text-xs sm:text-sm text-amber-950 space-y-2">
          <div className="flex items-start gap-2.5 font-semibold text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950 text-sm">
                เกณฑ์การคำนวณค่าคอมมิชชั่น — รหัสผู้ขนส่งเทียบเท่ากับพนักงานขับรถ:
              </span>
              <p className="font-normal text-amber-900 mt-1 leading-relaxed">
                เนื่องจากพนักงานขับรถอาจสลับคันขับ ระบบจะคำนวณค่าคอมมิชชั่นตาม <strong>รหัสผู้ขนส่ง</strong> หรือ <strong>ชื่อพนักงานขับรถ</strong> ที่กำหนดไว้ในแต่ละบิลเป็นหลัก โดยไม่ขึ้นกับทะเบียนหรือประเภทรถทางกายภาพของบิลนั้นๆ
              </p>
            </div>
          </div>
        </div>

        {/* Aggregate KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-100">
            <span className="text-xs text-amber-800 font-medium block">
              ค่าคอมมิชชั่นรวม (ช่วงที่เลือก)
            </span>
            <span className="text-xl sm:text-2xl font-bold text-amber-950 font-mono">
              ฿{Math.round(totalAllCommission).toLocaleString()}
            </span>
            <span className="text-[11px] text-amber-700 block mt-0.5">
              คำนวณจาก {totalAllTrips} เที่ยวขนส่ง
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-500 font-medium block">
              ปริมาณคอนกรีตรวม (ช่วงที่เลือก)
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
              {totalAllCues.toFixed(1)} คิว
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              จาก {filteredTickets.length} รายการบิล
            </span>
          </div>

          <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-100">
            <span className="text-xs text-blue-800 font-medium block">
              คนขับที่มีเที่ยววิ่งในช่วงนี้
            </span>
            <span className="text-xl sm:text-2xl font-bold text-blue-950">
              {activeDriversCount} / {driverSummaries.length} คน
            </span>
            <span className="text-[11px] text-blue-700 block mt-0.5">
              ทั้งหมดในระบบ {driverSummaries.length} คน
            </span>
          </div>
        </div>
      </div>

      {/* Main Table: Summary of All Drivers (ชีท รวมคิวรถโม่) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-600" />
            <span>ตารางสรุปคิว & ค่าคอมมิชชั่นรายคน</span>
          </h3>
          <span className="text-xs text-slate-500">คลิกที่แถวคนขับเพื่อดูกางรายละเอียดรายวัน</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">พนักงานขับรถ</th>
                <th className="py-2.5 px-3">รหัสผู้ขนส่ง (จากไฟล์)</th>
                <th className="py-2.5 px-3">ทะเบียนรถที่ขับวิ่งงาน</th>
                <th className="py-2.5 px-3 text-right">จำนวนเที่ยว</th>
                <th className="py-2.5 px-3 text-right">จำนวนคิว</th>
                <th className="py-2.5 px-3 text-right">ค่าคอมมิชชั่น</th>
                <th className="py-2.5 px-3 text-center">วิธีระบุคนขับ</th>
                <th className="py-2.5 px-3 text-center print:hidden">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {driverSummaries.map((d) => {
                const isSelected = activeDriver?.driverName === d.driverName;
                return (
                  <tr
                    key={d.driverName}
                    onClick={() => setSelectedDriverName(d.driverName)}
                    className={`transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/70 font-medium'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{d.driverName}</div>
                    </td>
                    <td className="py-3 px-3">
                      {d.carrierCode ? (
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {d.carrierCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {d.trucksDriven && d.trucksDriven.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {d.trucksDriven.map((plate) => (
                            <span
                              key={plate}
                              className="font-mono font-bold text-xs bg-amber-50 text-amber-950 px-2 py-0.5 rounded border border-amber-200"
                            >
                              {plate}
                            </span>
                          ))}
                          {d.trucksDriven.length > 1 && (
                            <span className="text-[11px] text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded font-semibold border border-amber-300">
                              (ขับ {d.trucksDriven.length} คัน)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-slate-400 text-xs">{d.plateNumber || '-'}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {d.totalTrips}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-900">
                      {d.totalCues > 0 ? d.totalCues.toFixed(1) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      ฿{Math.round(d.totalCommission).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center text-xs">
                      {d.matchedFromCodeCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px] font-medium">
                          ✓ รหัสผู้ขนส่ง ({d.matchedFromCodeCount})
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] font-medium"
                          title="ดึงจากทะเบียนรถหรือชื่อคนขับ"
                        >
                          ทะเบียน/ชื่อ ({d.matchedFromPlateCount})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center print:hidden">
                      <button
                        className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ดูกางเที่ยว
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="py-3 px-3 text-slate-900">
                  รวมทั้งสิ้น ({driverSummaries.length} คน)
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-900">
                  {totalAllTrips} เที่ยว
                </td>
                <td className="py-3 px-3 text-right font-mono text-amber-900">
                  {totalAllCues.toFixed(1)} คิว
                </td>
                <td className="py-3 px-3 text-right font-mono text-amber-950 text-base">
                  ฿{Math.round(totalAllCommission).toLocaleString()}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Driver Drill-down Detail Section (ใบสรุปจำนวนเที่ยว รายคน) */}
      {activeDriver && (
        <motion.div
          key={activeDriver.driverName}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full">
                  ใบสรุปจำนวนเที่ยวรายบุคคล
                </span>
                {activeDriver.carrierCode && (
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                    รหัสผู้ขนส่ง: {activeDriver.carrierCode}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  (คำนวณจากรหัสผู้ขนส่งเป็นหลัก · 1 คนอาจขับรถหลายคัน)
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                รายละเอียดการวิ่ง: {activeDriver.driverName}
              </h3>
              <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-slate-500 font-medium">ทะเบียนรถที่ขับวิ่งงาน:</span>
                {activeDriver.trucksDriven && activeDriver.trucksDriven.length > 0 ? (
                  activeDriver.trucksDriven.map((plate) => (
                    <span
                      key={plate}
                      className="font-mono font-bold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded text-xs border border-amber-300"
                    >
                      {plate}
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-slate-400">{activeDriver.plateNumber || '-'}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs sm:text-sm">
              <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500">เที่ยวสะสม:</span>{' '}
                <span className="font-bold text-slate-900">{activeDriver.totalTrips} เที่ยว</span>
              </div>
              <div className="bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                <span className="text-amber-800">คิวสะสม:</span>{' '}
                <span className="font-bold text-amber-950">{activeDriver.totalCues.toFixed(1)} คิว</span>
              </div>
              <div className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <span className="text-emerald-800">ค่าคอมมิชชั่น:</span>{' '}
                <span className="font-bold text-emerald-950">
                  ฿{Math.round(activeDriver.totalCommission).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Drill-down Table matching Section 3.3 format with explicit License Plate column */}
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">ว/ด/ป</th>
                  <th className="py-2 px-3 text-center">เที่ยวที่ของวัน</th>
                  <th className="py-2 px-3 text-center">ลำดับสะสม</th>
                  <th className="py-2 px-3">เวลาออก</th>
                  <th className="py-2 px-3">เลขบิล</th>
                  <th className="py-2 px-3 bg-amber-100/60 text-amber-950 font-bold border-x border-amber-200">
                    ทะเบียนรถ
                  </th>
                  <th className="py-2 px-3">เบอร์รถ / ประเภท</th>
                  <th className="py-2 px-3">ปลายทาง / ลูกค้า</th>
                  <th className="py-2 px-3">สเต็ง / เกรด</th>
                  <th className="py-2 px-3 text-right">จำนวนคิว</th>
                  <th className="py-2 px-3 text-right">คิวสะสม</th>
                  <th className="py-2 px-3 text-right">ค่าคอม (บาท)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeDriver.dailyTrips.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-6 text-center text-slate-400">
                      ไม่มีรายการวิ่งของพนักงานท่านนี้
                    </td>
                  </tr>
                ) : (
                  activeDriver.dailyTrips.map((trip) => (
                    <tr key={trip.ticketNumber} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-slate-700">{trip.date}</td>
                      <td className="py-2 px-3 text-center font-semibold text-slate-800">
                        {trip.tripIndex}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-500">
                        {trip.cumulativeTrip}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{trip.timeOut}</td>
                      <td className="py-2 px-3 font-mono text-slate-900">{trip.ticketNumber}</td>
                      <td className="py-2 px-3 bg-amber-50/40 border-x border-amber-100">
                        <span className="font-mono font-bold text-xs bg-white text-slate-900 px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {trip.plateNumber}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 text-xs">
                        <span className="font-semibold">
                          {trip.truckNumber !== '-' ? `เบอร์ ${trip.truckNumber}` : '-'}
                        </span>
                        {trip.truckType && trip.truckType !== '-' && (
                          <span className="text-[11px] text-slate-500 block">
                            {trip.truckType}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 max-w-[200px] truncate text-slate-800">
                        {trip.destination}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">{trip.grade}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {trip.cues.toFixed(1)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                        {trip.cumulativeCues.toFixed(1)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-amber-900">
                        ฿{trip.commission.toFixed(1)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};
