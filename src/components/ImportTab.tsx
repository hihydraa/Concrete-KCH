import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  FileCheck,
  Trash2,
  Filter,
  Layers,
  X,
  Check,
  Calendar,
  Truck,
  ArrowRight,
} from 'lucide-react';
import { PlantSettings, WeighTicket } from '../types';
import { parseWeighbridgeExcel, ParseWeighbridgeResult } from '../utils/excelParser';

interface ImportTabProps {
  settings: PlantSettings;
  setSettings: React.Dispatch<React.SetStateAction<PlantSettings>>;
  tickets: WeighTicket[];
  setTickets: React.Dispatch<React.SetStateAction<WeighTicket[]>>;
  onLoadSampleData: () => void;
  onClearData: () => void;
}

interface PendingImportData {
  file: File;
  result: ParseWeighbridgeResult;
}

export const ImportTab: React.FC<ImportTabProps> = ({
  settings,
  tickets,
  setTickets,
  onLoadSampleData,
  onClearData,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [importAllRows, setImportAllRows] = useState(true);
  const [pendingImport, setPendingImport] = useState<PendingImportData | null>(null);
  const [importNotice, setImportNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: {
      newCount: number;
      duplicateCount: number;
      totalSheetRows: number;
      sheetName: string;
      mergedSecondLines: number;
      headerFooterRows: number;
      blankRows: number;
      skippedRows: number;
    };
  } | null>(null);
  const [dragOverTicket, setDragOverTicket] = useState(false);

  const ticketFileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Pre-process file and open confirmation modal
  const handleTicketFileSelected = async (file: File) => {
    try {
      setIsProcessing(true);
      setImportNotice(null);
      const result = await parseWeighbridgeExcel(file, settings);

      if (result.tickets.length === 0) {
        setImportNotice({
          type: 'error',
          message: `ไม่พบรายการข้อมูลใบชั่งในไฟล์ ${file.name} (ตรวจพบแถวทั้งหมดในไฟล์ ${result.totalSheetRows.toLocaleString()} แถว) กรุณาตรวจสอบหัวตารางและรูปแบบชีท`,
        });
        setIsProcessing(false);
        return;
      }

      // Open confirmation modal with parsed result preview
      setPendingImport({
        file,
        result,
      });
    } catch (err: any) {
      console.error(err);
      setImportNotice({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการอ่านไฟล์: ${err?.message || 'ไม่สามารถเปิดไฟล์ Excel ได้'}`,
      });
    } finally {
      setIsProcessing(false);
      // Reset input element so re-selecting the same file will trigger onChange
      if (ticketFileInputRef.current) {
        ticketFileInputRef.current.value = '';
      }
    }
  };

  // Step 2: Confirm and commit data to state/database
  const handleConfirmImport = () => {
    if (!pendingImport) return;

    const { file, result } = pendingImport;
    let finalTicketsToSet: WeighTicket[] = [];
    let duplicateCount = 0;

    if (importMode === 'replace') {
      // REPLACE MODE: Replace all existing tickets with the new file
      if (importAllRows) {
        const seenKeyCounts = new Map<string, number>();
        finalTicketsToSet = result.tickets.map((t) => {
          const baseKey = t.ticketNumber.trim();
          const count = seenKeyCounts.get(baseKey) || 0;
          seenKeyCounts.set(baseKey, count + 1);
          if (count > 0) {
            return {
              ...t,
              ticketNumber: `${t.ticketNumber}#${count + 1}`,
            };
          }
          return t;
        });
        duplicateCount = 0;
      } else {
        const seenExact = new Set<string>();
        finalTicketsToSet = [];
        result.tickets.forEach((t) => {
          const exactKey = `${t.ticketNumber.trim().toLowerCase()}___${t.dateIn}___${t.timeIn}___${t.weightNet}`;
          if (seenExact.has(exactKey)) {
            duplicateCount++;
          } else {
            seenExact.add(exactKey);
            finalTicketsToSet.push(t);
          }
        });
      }
    } else {
      // APPEND MODE: Merge with existing tickets
      if (importAllRows) {
        const seenKeyCounts = new Map<string, number>();
        tickets.forEach((t) => {
          const baseKey = t.ticketNumber.trim();
          seenKeyCounts.set(baseKey, (seenKeyCounts.get(baseKey) || 0) + 1);
        });

        const adjustedNewTickets = result.tickets.map((t) => {
          const baseKey = t.ticketNumber.trim();
          const count = seenKeyCounts.get(baseKey) || 0;
          seenKeyCounts.set(baseKey, count + 1);
          if (count > 0) {
            return {
              ...t,
              ticketNumber: `${t.ticketNumber}#${count + 1}`,
            };
          }
          return t;
        });

        finalTicketsToSet = [...tickets, ...adjustedNewTickets];
        duplicateCount = 0;
      } else {
        const existingExact = new Set(
          tickets.map((t) => `${t.ticketNumber.trim().toLowerCase()}___${t.dateIn}___${t.timeIn}___${t.weightNet}`)
        );
        const newToAdd: WeighTicket[] = [];
        result.tickets.forEach((t) => {
          const exactKey = `${t.ticketNumber.trim().toLowerCase()}___${t.dateIn}___${t.timeIn}___${t.weightNet}`;
          if (existingExact.has(exactKey)) {
            duplicateCount++;
          } else {
            existingExact.add(exactKey);
            newToAdd.push(t);
          }
        });
        finalTicketsToSet = [...tickets, ...newToAdd];
      }
    }

    // Sort tickets chronologically
    finalTicketsToSet.sort((a, b) => {
      const comp = a.dateIn.localeCompare(b.dateIn);
      if (comp !== 0) return comp;
      return a.timeIn.localeCompare(b.timeIn);
    });

    setTickets(finalTicketsToSet);

    const importedCount = importMode === 'replace' ? finalTicketsToSet.length : finalTicketsToSet.length - tickets.length;
    const warningText = result.warnings.length > 0 ? ` [${result.warnings.join(', ')}]` : '';

    setImportNotice({
      type: 'success',
      message: `นำเข้าข้อมูลสำเร็จ ${importedCount.toLocaleString()} บิล${
        importMode === 'replace' ? ' (แทนที่ข้อมูลเดิมเรียบร้อย)' : ' (เพิ่มต่อท้ายข้อมูลเดิม)'
      }${duplicateCount > 0 ? ` (ข้ามแถวซ้ำ 100% จำนวน ${duplicateCount} แถว)` : ''} จากไฟล์ ${file.name}${warningText}`,
      details: {
        newCount: importedCount,
        duplicateCount,
        totalSheetRows: result.totalSheetRows,
        sheetName: result.sheetName,
        mergedSecondLines: result.mergedSecondLines,
        headerFooterRows: result.headerFooterRows,
        blankRows: result.blankRows,
        skippedRows: result.skippedRows,
      },
    });

    // Close modal
    setPendingImport(null);
  };

  // Helper date range from pending tickets
  const pendingDates = pendingImport?.result.tickets.map((t) => t.dateIn).filter(Boolean) || [];
  const minDate = pendingDates.length > 0 ? [...pendingDates].sort()[0] : '';
  const maxDate = pendingDates.length > 0 ? [...pendingDates].sort()[pendingDates.length - 1] : '';
  const uniquePlates = pendingImport ? new Set(pendingImport.result.tickets.map((t) => t.plateNumber).filter(Boolean)).size : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Welcome & Action Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                <Sparkles className="w-3 h-3 text-amber-700" />
                นำเข้าข้อมูลดิบตาชั่ง
              </span>
              <span className="text-xs text-slate-500">ระบบเช็คเลขที่ใบชั่งซ้ำอัตโนมัติ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              นำเข้าไฟล์รายงานตาชั่งรายวัน
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              รองรับไฟล์ Excel export จากโปรแกรมตาชั่ง (เช่น{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-amber-800 font-mono">
                0108_0209_report.xlsx
              </code>
              ) ระบบจะตรวจเลขที่ใบชั่ง หากมีอยู่ในระบบแล้วจะไม่ดึงแถวนั้นเข้าซ้ำ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tickets.length > 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>มีข้อมูลในระบบ {tickets.length.toLocaleString()} บิล</span>
                </span>

                <button
                  id="btn-load-verified-sample"
                  type="button"
                  onClick={onLoadSampleData}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200 transition cursor-pointer"
                  title="สลับไปใช้ชุดข้อมูลตัวอย่าง 1-8 ก.ย. 2569 สำหรับทดสอบดูรายงาน"
                >
                  <FileCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>ชุดข้อมูลตัวอย่าง (1-8 ก.ย. 2569)</span>
                </button>

                <button
                  id="btn-clear-all-tickets"
                  type="button"
                  onClick={onClearData}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs border border-rose-200 transition cursor-pointer"
                  title="ล้างข้อมูลใบชั่งทั้งหมดออกจากระบบ"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>ล้างข้อมูล</span>
                </button>
              </>
            ) : (
              <button
                id="btn-load-verified-sample"
                type="button"
                onClick={onLoadSampleData}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs sm:text-sm border border-slate-300 transition cursor-pointer"
                title="สำหรับผู้ที่ยังไม่มีไฟล์ และต้องการทดสอบระบบเพื่อดูตัวอย่างแดชบอร์ด"
              >
                <FileCheck className="w-4 h-4 text-amber-600" />
                <span>ทดลองด้วยข้อมูลตัวอย่าง (Demo 565 บิล)</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alert Notice */}
        {importNotice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`mt-4 p-4 rounded-xl border flex items-start gap-3 text-xs sm:text-sm ${
              importNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : importNotice.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            {importNotice.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-semibold">{importNotice.message}</div>
              {importNotice.details && (
                <div className="mt-3 pt-3 border-t border-emerald-200/60 text-xs space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-500 block">ชีทที่ประมวลผล:</span>
                      <span className="font-medium text-slate-800">{importNotice.details.sheetName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">แถวทั้งหมดในไฟล์:</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {importNotice.details.totalSheetRows.toLocaleString()} แถว
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">นำเข้าสำเร็จ (100%):</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {importNotice.details.newCount.toLocaleString()} บิล
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">บรรทัดที่ 2 (ชั่งออก/คนขับ):</span>
                      <span className="font-medium text-blue-700 font-mono">
                        รวมเข้าบิล {importNotice.details.mergedSecondLines?.toLocaleString() || 0} แถว
                      </span>
                    </div>
                  </div>

                  <div className="bg-emerald-100/60 p-2.5 rounded-lg text-emerald-900 border border-emerald-200/80 leading-relaxed">
                    <span className="font-bold mr-1">💡 โครงสร้างแถวในไฟล์:</span>
                    ไฟล์รายงานโปรแกรมตาชั่งพิมพ์ 2 บรรทัดต่อ 1 ใบชั่ง (บรรทัดชั่งเข้า + บรรทัดชั่งออก/คนขับ รวม {((importNotice.details.newCount || 0) * 2).toLocaleString()} แถว) รวมกับหัวรายงานซ้ำทุกหน้ากระดาษและยอดรวมประจำหน้า {((importNotice.details.headerFooterRows || 0) + (importNotice.details.blankRows || 0)).toLocaleString()} แถว รวมเป็น {importNotice.details.totalSheetRows.toLocaleString()} แถวพอดี — <strong>ข้อมูลใบชั่งครบถ้วนสมบูรณ์ ไม่มีบิลตกหล่น</strong>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Single File Upload Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-base">
              1
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                ไฟล์รายงานตาชั่งรายวัน (ข้อมูลดิบ)
              </h3>
              <p className="text-xs text-slate-500">
                ไฟล์ Excel ที่ส่งออกจากโปรแกรมตาชั่ง (.xlsx / .xls / .csv) รองรับทุกจำนวนแถวและหลายชีท
              </p>
            </div>
          </div>
          <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200 font-mono">
            .xlsx / .xls
          </span>
        </div>

        {/* Import Settings Bar */}
        <div className="mb-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-700">โหมดการนำเข้า:</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-amber-600"
                />
                <span>แทนที่ข้อมูลเดิมทั้งหมด (แนะนำ)</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="accent-amber-600"
                />
                <span>เพิ่มต่อท้ายข้อมูลเดิม</span>
              </label>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700 sm:border-l sm:border-slate-200 sm:pl-4">
              <input
                type="checkbox"
                checked={importAllRows}
                onChange={(e) => setImportAllRows(e.target.checked)}
                className="rounded accent-amber-600 cursor-pointer"
              />
              <span>นำเข้าทุกแถวในไฟล์ (ไม่ตัดแถว)</span>
            </label>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          id="weighbridge-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverTicket(true);
          }}
          onDragLeave={() => setDragOverTicket(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverTicket(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleTicketFileSelected(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => ticketFileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer ${
            dragOverTicket
              ? 'border-amber-500 bg-amber-50/70 scale-[0.99]'
              : 'border-slate-300 hover:border-amber-400 bg-slate-50/60 hover:bg-amber-50/20'
          }`}
        >
          <input
            ref={ticketFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleTicketFileSelected(e.target.files[0]);
              }
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8" />
          </div>
          <div className="font-bold text-base text-slate-900">
            คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            เมื่อเลือกไฟล์แล้ว ระบบจะแสดงหน้าต่างตรวจสอบข้อมูลพร้อมปุ่ม <strong>"ยืนยันก่อนอัพโหลด"</strong> เพื่อให้ท่านตรวจสอบความถูกต้องก่อนบันทึก
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-600 shadow-2xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>มีระบบตรวจพรีวิวและปุ่มกดยืนยันก่อนบันทึกลงฐานข้อมูล</span>
          </div>
        </div>

        {/* Bottom instructions */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>หากต้องการแก้ไขสินค้า รถ คนขับ หรืออัตราค่าคอม ให้ไปที่เมนู <strong>"ตั้งค่าระบบ"</strong></span>
          </div>
          {isProcessing && (
            <span className="text-amber-700 font-semibold animate-pulse">
              กำลังอ่านและวิเคราะห์โครงสร้างไฟล์...
            </span>
          )}
        </div>
      </motion.div>

      {/* Confirmation Modal Before Upload */}
      <AnimatePresence>
        {pendingImport && (
          <div
            id="import-confirm-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      ยืนยันการนำเข้าข้อมูลใบชั่ง
                    </h3>
                    <p className="text-xs text-slate-500">
                      กรุณาตรวจสอบข้อมูลสรุปและตัวอย่างรายการก่อนกดยืนยันบันทึกข้อมูล
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  title="ปิดหน้าต่าง"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm">
                {/* File & Detection Summary Card */}
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80">
                  <div className="font-semibold text-amber-950 text-sm mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      ข้อมูลไฟล์ที่ตรวจพบ
                    </span>
                    <span className="text-xs font-mono font-normal text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded border border-amber-300">
                      {pendingImport.file.name} ({(pendingImport.file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                      <span className="text-slate-500 block">จำนวนใบชั่งที่อ่านได้</span>
                      <span className="text-xl font-bold text-emerald-700 font-mono">
                        {pendingImport.result.tickets.length.toLocaleString()}
                      </span>
                      <span className="text-slate-500 text-[11px] ml-1">บิล</span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                      <span className="text-slate-500 block">ระบุรหัสผู้ขนส่ง/คนขับ</span>
                      <span className="text-xl font-bold text-amber-700 font-mono">
                        {pendingImport.result.tickets.filter((t) => (t.driverName && t.driverName !== 'ไม่ระบุ') || (t.carrierCode && t.carrierCode !== '0')).length.toLocaleString()}
                      </span>
                      <span className="text-slate-500 text-[11px] ml-1">บิล</span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                      <span className="text-slate-500 block">แถวหัวรายงาน/สรุปยอด</span>
                      <span className="text-xl font-bold text-slate-600 font-mono">
                        {(pendingImport.result.headerFooterRows + pendingImport.result.blankRows).toLocaleString()}
                      </span>
                      <span className="text-slate-500 text-[11px] ml-1">แถว</span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-2xs">
                      <span className="text-slate-500 block">จำนวนรถที่พบ</span>
                      <span className="text-xl font-bold text-blue-700 font-mono">
                        {uniquePlates}
                      </span>
                      <span className="text-slate-500 text-[11px] ml-1">คัน</span>
                    </div>
                  </div>

                  {minDate && maxDate && (
                    <div className="mt-3 pt-2.5 border-t border-amber-200/50 flex flex-wrap items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-700" />
                        <span>ช่วงวันที่ในไฟล์: <strong>{minDate}</strong> ถึง <strong>{maxDate}</strong></span>
                      </div>
                      <div className="text-slate-500">
                        ชีทที่ประมวลผล: <strong className="text-slate-700">{pendingImport.result.sheetName}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Import Mode Selector */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-semibold text-slate-800 text-xs">
                    เลือกรูปแบบการบันทึก:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                        importMode === 'replace'
                          ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-medium ring-1 ring-amber-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="confirmImportMode"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="mt-0.5 accent-amber-600"
                      />
                      <div>
                        <span className="font-bold block">แทนที่ข้อมูลเดิมทั้งหมด (แนะนำ)</span>
                        <span className="text-slate-500 text-[11px]">
                          {tickets.length > 0
                            ? `จะล้าง ${tickets.length.toLocaleString()} บิลเดิม และแทนที่ด้วย ${pendingImport.result.tickets.length.toLocaleString()} บิลใหม่นี้`
                            : `บันทึกข้อมูลชุดใหม่ ${pendingImport.result.tickets.length.toLocaleString()} บิล`}
                        </span>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                        importMode === 'append'
                          ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-medium ring-1 ring-amber-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="confirmImportMode"
                        value="append"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="mt-0.5 accent-amber-600"
                      />
                      <div>
                        <span className="font-bold block">เพิ่มต่อท้ายข้อมูลเดิม</span>
                        <span className="text-slate-500 text-[11px]">
                          นำบิลใหม่เข้าไปบวกเพิ่มกับของเดิม ({tickets.length.toLocaleString()} บิลเดิม + {pendingImport.result.tickets.length.toLocaleString()} บิลใหม่)
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Preview Table of First 5 rows */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 text-xs">
                      ตัวอย่าง 5 รายการแรกที่อ่านได้จากไฟล์:
                    </span>
                    <span className="text-xs text-slate-500">
                      แสดง 5 จาก {pendingImport.result.tickets.length.toLocaleString()} บิล
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold">เลขที่บิล</th>
                          <th className="py-2 px-3 font-semibold">วันที่/เวลา</th>
                          <th className="py-2 px-3 font-semibold">ทะเบียน</th>
                          <th className="py-2 px-3 font-semibold">สินค้า</th>
                          <th className="py-2 px-3 font-semibold text-right">นน.สุทธิ (กก.)</th>
                          <th className="py-2 px-3 font-semibold text-right">ปริมาณ</th>
                          <th className="py-2 px-3 font-semibold">รหัสผู้ขนส่ง</th>
                          <th className="py-2 px-3 font-semibold">พนักงานขับรถ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {pendingImport.result.tickets.slice(0, 5).map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-medium text-slate-900">{t.ticketNumber}</td>
                            <td className="py-2 px-3 text-slate-600 text-[11px]">
                              {t.dateIn} {t.timeIn}
                            </td>
                            <td className="py-2 px-3 text-slate-800">{t.plateNumber || '-'}</td>
                            <td className="py-2 px-3 text-slate-700 font-sans max-w-[120px] truncate" title={t.productName}>
                              {t.productName || '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900 font-bold">
                              {t.weightNet.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-amber-800">
                              {t.quantity.toFixed(1)} {t.quantityUnit}
                            </td>
                            <td className="py-2 px-3 font-medium">
                              {t.carrierCode && t.carrierCode !== '0' ? (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded text-[11px] font-bold">
                                  {t.carrierCode}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-sans max-w-[120px] truncate">
                              {t.driverName && t.driverName !== 'ไม่ระบุ' ? (
                                <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                                  {t.driverName}
                                </span>
                              ) : (
                                <span className="text-rose-600 italic text-[11px]">ไม่ระบุ</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer with Actions */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  id="btn-cancel-import-modal"
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200 font-medium text-xs sm:text-sm transition cursor-pointer text-center"
                >
                  ยกเลิก
                </button>

                <button
                  id="btn-confirm-import-modal"
                  type="button"
                  onClick={handleConfirmImport}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>ยืนยันนำเข้าข้อมูล ({pendingImport.result.tickets.length.toLocaleString()} บิล)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Current Data Overview */}
      {tickets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>สรุปสถานะข้อมูลในระบบปัจจุบัน ({tickets.length} บิล)</span>
            </h3>
            <span className="text-xs text-slate-500">
              {new Set(tickets.map((t) => t.dateIn)).size} วันทำการ
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">บิลคอนกรีตขายออก</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                {tickets.filter((t) => t.isConcrete).length} บิล
              </span>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <span className="text-xs text-amber-800 block">ปริมาณคอนกรีตรวม</span>
              <span className="text-lg font-bold text-amber-950 font-mono">
                {tickets
                  .filter((t) => t.isConcrete)
                  .reduce((sum, t) => sum + t.quantity, 0)
                  .toFixed(1)}{' '}
                คิว
              </span>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-xs text-blue-800 block">บิลวัตถุดิบรับเข้า</span>
              <span className="text-lg font-bold text-blue-950 font-mono">
                {tickets.filter((t) => t.direction === 'in').length} บิล
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">น้ำหนักวัตถุดิบ</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                {(
                  tickets
                    .filter((t) => t.direction === 'in')
                    .reduce((sum, t) => sum + t.weightNet, 0) / 1000
                ).toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                ตัน
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
