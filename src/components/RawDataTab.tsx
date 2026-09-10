import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  ArrowUpDown,
  Tag,
  UserCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PlantSettings, WeighTicket } from '../types';
import { enrichTicket } from '../utils/textNormalizer';

interface RawDataTabProps {
  tickets: WeighTicket[];
  settings?: PlantSettings;
  onEditTicket: (ticket: WeighTicket) => void;
  onSaveTicket?: (ticket: WeighTicket) => void;
  onDeleteTicket?: (ticket: WeighTicket) => void;
}

export const RawDataTab: React.FC<RawDataTabProps> = ({
  tickets,
  settings,
  onEditTicket,
  onSaveTicket,
  onDeleteTicket,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'audit' | 'no_driver_or_code' | 'concrete' | 'raw_material'
  >('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Available dates
  const availableDates = useMemo(() => {
    return Array.from(new Set(tickets.map((t) => t.dateIn))).filter(Boolean).sort();
  }, [tickets]);

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Date filter
      if (selectedDate !== 'all' && t.dateIn !== selectedDate) return false;

      // Type filter
      if (activeFilter === 'audit' && !t.needsAudit) return false;
      if (activeFilter === 'concrete' && !t.isConcrete) return false;
      if (activeFilter === 'raw_material' && t.direction !== 'in') return false;
      if (
        activeFilter === 'no_driver_or_code' &&
        t.driverName &&
        t.driverName !== 'ไม่ระบุ' &&
        t.carrierCode &&
        t.carrierCode !== '0'
      ) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTicket = t.ticketNumber.toLowerCase().includes(query);
        const matchPlate = t.plateNumber.toLowerCase().includes(query);
        const matchCustomer = (t.customerName || '').toLowerCase().includes(query);
        const matchProduct = (t.productName || '').toLowerCase().includes(query);
        const matchDriver = (t.driverName || '').toLowerCase().includes(query);
        const matchCarrier = (t.carrierCode || '').toLowerCase().includes(query);
        return (
          matchTicket ||
          matchPlate ||
          matchCustomer ||
          matchProduct ||
          matchDriver ||
          matchCarrier
        );
      }

      return true;
    });
  }, [tickets, selectedDate, activeFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, page, pageSize]);

  // Counts for tabs
  const auditCount = useMemo(() => tickets.filter((t) => t.needsAudit).length, [tickets]);
  const concreteCount = useMemo(() => tickets.filter((t) => t.isConcrete).length, [tickets]);
  const rawMaterialCount = useMemo(() => tickets.filter((t) => t.direction === 'in').length, [tickets]);
  const noDriverOrCodeCount = useMemo(
    () =>
      tickets.filter(
        (t) =>
          !t.driverName ||
          t.driverName === 'ไม่ระบุ' ||
          !t.carrierCode ||
          t.carrierCode === '0'
      ).length,
    [tickets]
  );

  const handleQuickAssignDriver = (ticket: WeighTicket, driverName: string) => {
    if (!settings) {
      onEditTicket(ticket);
      return;
    }
    const truck = settings.trucks.find((tr) => tr.driverName === driverName);
    const updated = enrichTicket(
      {
        ...ticket,
        driverName: driverName || undefined,
        carrierCode: truck?.carrierCode || ticket.carrierCode,
        matchedBy: 'manual',
        isOverridden: true,
      },
      settings
    );
    if (onSaveTicket) {
      onSaveTicket(updated);
    } else {
      onEditTicket(updated);
    }
  };

  const handleExportFiltered = () => {
    const data = filteredTickets.map((t, idx) => ({
      'ลำดับ': idx + 1,
      'เลขที่ใบชั่ง': t.ticketNumber,
      'วันที่': t.dateIn,
      'เวลาเข้า': t.timeIn,
      'เวลาออก': t.timeOut,
      'ทะเบียนรถ': t.plateNumber,
      'เบอร์รถ': t.truckNumber,
      'คนขับ': t.driverName,
      'ลูกค้า': t.customerName || 'ไม่ระบุ',
      'สินค้า': t.productName || 'ไม่ระบุ',
      'นน.เข้า': t.weightIn,
      'นน.ออก': t.weightOut,
      'นน.สุทธิ': t.weightNet,
      'จำนวน': t.quantity,
      'หน่วย': t.quantityUnit,
      'รหัสผู้ขนส่ง': t.carrierCode,
      'วิธีจับคู่': t.matchedBy,
      'สถานะตรวจสอบ': t.needsAudit ? `เตือน: ${t.auditReasons.join('; ')}` : 'ปกติ',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ข้อมูลดิบ');
    XLSX.writeFile(wb, `ข้อมูลดิบตาชั่ง_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              ข้อมูลดิบใบชั่ง & ตรวจสอบความถูกต้อง
            </h2>
            <p className="text-xs text-slate-500">
              แสดงข้อมูลทุกบิลที่ผ่านการแปลง ค้นหา ตรวจสอบรายการผิดปกติ และแก้ไขได้ทันที
            </p>
          </div>

          <button
            id="btn-export-raw-excel"
            onClick={handleExportFiltered}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium shadow-xs transition cursor-pointer self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export ข้อมูลที่กรอง ({filteredTickets.length})</span>
          </button>
        </div>

        {/* Search input & date filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาเลขบิล, ทะเบียนรถ, ชื่อลูกค้า, สินค้า, หรือคนขับ..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="all">ทุกวันที่ ({tickets.length} บิล)</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={() => {
              setActiveFilter('all');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({tickets.length})
          </button>

          <button
            id="filter-chip-no-driver-code"
            onClick={() => {
              setActiveFilter('no_driver_or_code');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeFilter === 'no_driver_or_code'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-700" />
            <span>ยังไม่ระบุคนขับ / รหัสผู้ขนส่ง ({noDriverOrCodeCount})</span>
          </button>

          <button
            id="filter-chip-audit"
            onClick={() => {
              setActiveFilter('audit');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeFilter === 'audit'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>ต้องตรวจสอบ ({auditCount})</span>
          </button>

          <button
            onClick={() => {
              setActiveFilter('concrete');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeFilter === 'concrete'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            คอนกรีตขายออก ({concreteCount})
          </button>

          <button
            onClick={() => {
              setActiveFilter('raw_material');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeFilter === 'raw_material'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            วัตถุดิบรับเข้า ({rawMaterialCount})
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            แสดงผล {paginatedTickets.length} จาก {filteredTickets.length} รายการ (หน้า {page}/{totalPages})
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-slate-100 disabled:opacity-40 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              ก่อนหน้า
            </button>
            <span className="px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-slate-100 disabled:opacity-40 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              ถัดไป
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">เลขที่ใบชั่ง</th>
                <th className="py-2.5 px-3">ว/ด/ป · เวลา</th>
                <th className="py-2.5 px-3">ทะเบียน / เบอร์รถ</th>
                <th className="py-2.5 px-3">รหัสผู้ขนส่ง</th>
                <th className="py-2.5 px-3">พนักงานขับรถ</th>
                <th className="py-2.5 px-3">ลูกค้า</th>
                <th className="py-2.5 px-3">สินค้า</th>
                <th className="py-2.5 px-3 text-right">นน.สุทธิ</th>
                <th className="py-2.5 px-3 text-right">จำนวน</th>
                <th className="py-2.5 px-3 text-center">สถานะ</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTickets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t) => (
                  <tr
                    key={t.ticketNumber}
                    className={`hover:bg-slate-50/80 transition ${
                      t.needsAudit ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                      {t.ticketNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                      <div>{t.dateIn}</div>
                      <div className="text-[11px] text-slate-400">{t.timeIn}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{t.plateNumber}</div>
                      <div className="text-[11px] text-slate-500">
                        {t.truckNumber ? `เบอร์ ${t.truckNumber}` : '-'}
                        {t.truckType && ` (${t.truckType})`}
                      </div>
                    </td>

                    {/* รหัสผู้ขนส่ง (Carrier Code) */}
                    <td className="py-2.5 px-3">
                      {t.carrierCode && t.carrierCode !== '0' ? (
                        <div className="flex items-center gap-1">
                          <span
                            onClick={() => onEditTicket(t)}
                            className="font-mono font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 cursor-pointer transition text-xs"
                            title="คลิกเพื่อแก้ไขรหัสผู้ขนส่ง"
                          >
                            {t.carrierCode}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => onEditTicket(t)}
                          className="text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-dashed border-amber-300 transition cursor-pointer flex items-center gap-1"
                          title="คลิกเพื่อกำหนดรหัสผู้ขนส่ง"
                        >
                          <Tag className="w-3 h-3 text-amber-600" />
                          <span>+ กำหนดรหัส</span>
                        </button>
                      )}
                    </td>

                    {/* พนักงานขับรถ (Driver Name) */}
                    <td className="py-2.5 px-3">
                      {settings?.trucks && settings.trucks.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={
                              t.driverName && t.driverName !== 'ไม่ระบุ'
                                ? t.driverName
                                : ''
                            }
                            onChange={(e) => handleQuickAssignDriver(t, e.target.value)}
                            className={`text-xs py-1 px-1.5 rounded-lg border font-medium cursor-pointer max-w-[155px] ${
                              t.driverName && t.driverName !== 'ไม่ระบุ'
                                ? 'bg-white text-slate-900 border-slate-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                          >
                            <option value="">-- ยังไม่ระบุคนขับ --</option>
                            {settings.trucks.map((trk) => (
                              <option key={trk.driverName} value={trk.driverName}>
                                {trk.driverName} {trk.carrierCode ? `[${trk.carrierCode}]` : ''}
                              </option>
                            ))}
                          </select>

                          {/* Matching badge indicator */}
                          <div className="flex items-center gap-1">
                            {t.matchedBy === 'manual' ? (
                              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                                ✏️ ระบุเอง
                              </span>
                            ) : t.matchedBy === 'code' ? (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                ตามรหัส
                              </span>
                            ) : t.matchedBy === 'driver' ? (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                                ตามชื่อ
                              </span>
                            ) : t.matchedBy === 'plate' ? (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                ตามทะเบียน
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                                ไม่ระบุ
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-slate-900">{t.driverName}</span>
                          <button
                            onClick={() => onEditTicket(t)}
                            className="text-slate-400 hover:text-amber-700 p-0.5"
                            title="แก้ไขคนขับ"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 max-w-[170px] truncate">
                      {t.customerName ? (
                        <span className="text-slate-800">{t.customerName}</span>
                      ) : (
                        <span className="text-rose-600 font-semibold italic">
                          ⚠️ ไม่ระบุลูกค้า
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 max-w-[170px] truncate">
                      {t.productName ? (
                        <div>
                          <span
                            className={
                              t.isConcrete ? 'font-semibold text-amber-900' : 'text-slate-700'
                            }
                          >
                            {t.productName}
                          </span>
                          {t.productCode && (
                            <div className="text-[10px] font-mono text-slate-400">
                              รหัส: {t.productCode}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-rose-600 font-semibold italic">
                          ⚠️ ไม่ระบุสินค้า
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {t.weightNet.toLocaleString()} กก.
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className="text-slate-900">
                        {t.quantity.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </span>{' '}
                      <span className="text-slate-500 text-xs font-normal">
                        {t.quantityUnit}
                      </span>
                      {t.isQuantityOverridden && (
                        <span
                          className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded font-semibold"
                          title="จำนวนคิวกำหนดเอง"
                        >
                          แก้คิว
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {t.needsAudit ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800"
                          title={t.auditReasons.join(', ')}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>ต้องตรวจ</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ปกติ</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEditTicket(t)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-slate-100 transition cursor-pointer"
                          title="ดูและแก้ไขบิล"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteTicket && (
                          <button
                            onClick={() => onDeleteTicket(t)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                            title="ลบใบชั่งนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <div className="p-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>รวมทั้งหมด {filteredTickets.length} รายการ</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 text-slate-700 cursor-pointer font-medium"
            >
              หน้าก่อนหน้า
            </button>
            <span className="font-semibold text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 text-slate-700 cursor-pointer font-medium"
            >
              หน้าถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
