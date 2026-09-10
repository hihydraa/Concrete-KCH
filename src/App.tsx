import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { ActiveTab, Navbar } from './components/Navbar';
import { ImportTab } from './components/ImportTab';
import { DashboardTab } from './components/DashboardTab';
import { DailyBillsTab } from './components/DailyBillsTab';
import { CommissionTab } from './components/CommissionTab';
import { RawDataTab } from './components/RawDataTab';
import { SettingsTab } from './components/SettingsTab';
import { TicketDetailModal } from './components/TicketDetailModal';
import { defaultSettings } from './data/masterSettings';
import { generateVerifiedSampleTickets } from './data/sampleDataset';
import { PlantSettings, WeighTicket } from './types';
import { enrichTicket } from './utils/textNormalizer';

const STORAGE_KEY = 'cp_plant_tickets_v7';

export default function App() {
  // Initialize from localStorage if available, or default to verified 1-8 Sep sample data
  const [tickets, setTickets] = useState<WeighTicket[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: WeighTicket) => enrichTicket(t, defaultSettings));
        }
      }
    } catch (e) {
      console.error('Failed to load tickets from localStorage:', e);
    }
    // Default to verified 1-8 Sep 2026 dataset (565 bills)
    return generateVerifiedSampleTickets();
  });

  const [settings, setSettings] = useState<PlantSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Persist tickets whenever they change
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [tickets]);

  // Default dailyViewDate to the latest date in tickets or current date
  const [dailyViewDate, setDailyViewDate] = useState<string>(() => {
    if (tickets.length > 0) {
      const dates = Array.from(new Set(tickets.map((t) => t.dateIn))).filter(Boolean).sort();
      if (dates.length > 0) return dates[dates.length - 1];
    }
    return '';
  });

  // Automatically update dailyViewDate if current date is not in the tickets dataset
  React.useEffect(() => {
    if (tickets.length > 0) {
      const dates = Array.from(new Set(tickets.map((t) => t.dateIn))).filter(Boolean).sort();
      if (dates.length > 0 && (!dailyViewDate || !dates.includes(dailyViewDate))) {
        setDailyViewDate(dates[dates.length - 1]);
      }
    }
  }, [tickets, dailyViewDate]);
  const [editingTicket, setEditingTicket] = useState<WeighTicket | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [ticketToDelete, setTicketToDelete] = useState<WeighTicket | null>(null);

  // Re-calculate tickets when settings change (e.g. rounding or truck commission rates)
  const handleSettingsUpdated = () => {
    setTickets((prev) => prev.map((t) => enrichTicket(t, settings)));
  };

  // Quick reload of verified sample dataset
  const handleLoadSampleData = () => {
    setTickets(generateVerifiedSampleTickets());
    setActiveTab('dashboard');
  };

  const handleClearData = () => {
    setShowClearConfirmModal(true);
  };

  const handleConfirmClearData = () => {
    setTickets([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setShowClearConfirmModal(false);
  };

  // Navigate to Raw Audit filter
  const handleNavigateToRawAudit = () => {
    setActiveTab('raw');
  };

  // Navigate to Daily Bill of a specific day
  const handleNavigateToDaily = (date: string) => {
    setDailyViewDate(date);
    setActiveTab('daily');
  };

  // Handle single ticket update
  const handleSaveTicket = (updated: WeighTicket) => {
    setTickets((prev) => prev.map((t) => (t.ticketNumber === updated.ticketNumber ? updated : t)));
  };

  // Delete a single ticket (asks for confirmation first)
  const handleRequestDeleteTicket = (ticket: WeighTicket) => {
    setTicketToDelete(ticket);
  };

  const handleConfirmDeleteTicket = () => {
    if (ticketToDelete) {
      setTickets((prev) => prev.filter((t) => t.ticketNumber !== ticketToDelete.ticketNumber));
      if (editingTicket && editingTicket.ticketNumber === ticketToDelete.ticketNumber) {
        setEditingTicket(null);
      }
    }
    setTicketToDelete(null);
  };

  // Summary counts
  const auditCount = useMemo(() => tickets.filter((t) => t.needsAudit).length, [tickets]);

  const dateRangeLabel = useMemo(() => {
    if (tickets.length === 0) return '';
    const dates = Array.from(new Set(tickets.map((t) => t.dateIn))).filter(Boolean).sort();
    if (dates.length === 0) return '';
    if (dates.length === 1) return dates[0];
    return `${dates[0]} ถึง ${dates[dates.length - 1]}`;
  }, [tickets]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalTickets={tickets.length}
        auditCount={auditCount}
        dateRangeLabel={dateRangeLabel}
        onQuickLoadSample={handleLoadSampleData}
        onClearData={handleClearData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'import' && (
              <ImportTab
                settings={settings}
                setSettings={setSettings}
                tickets={tickets}
                setTickets={setTickets}
                onLoadSampleData={handleLoadSampleData}
                onClearData={handleClearData}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardTab
                tickets={tickets}
                settings={settings}
                onNavigateToRawAudit={handleNavigateToRawAudit}
                onNavigateToDaily={handleNavigateToDaily}
              />
            )}

            {activeTab === 'daily' && (
              <DailyBillsTab
                tickets={tickets}
                settings={settings}
                initialDate={dailyViewDate}
                onEditTicket={(t) => setEditingTicket(t)}
                onDeleteTicket={handleRequestDeleteTicket}
              />
            )}

            {activeTab === 'commission' && (
              <CommissionTab tickets={tickets} settings={settings} />
            )}

            {activeTab === 'raw' && (
              <RawDataTab
                tickets={tickets}
                settings={settings}
                onEditTicket={(t) => setEditingTicket(t)}
                onSaveTicket={handleSaveTicket}
                onDeleteTicket={handleRequestDeleteTicket}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                settings={settings}
                setSettings={setSettings}
                onSettingsUpdated={handleSettingsUpdated}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Edit Ticket Modal */}
      <TicketDetailModal
        ticket={editingTicket}
        settings={settings}
        isOpen={!!editingTicket}
        onClose={() => setEditingTicket(null)}
        onSave={handleSaveTicket}
      />

      {/* In-app Clear Data Confirmation Modal (iframe-safe, no native confirm required) */}
      <AnimatePresence>
        {showClearConfirmModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setShowClearConfirmModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative"
            >
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">
                ยืนยันการล้างข้อมูลใบชั่งทั้งหมด
              </h3>

              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                คุณต้องการล้างข้อมูลใบชั่งทั้งหมดออกจากระบบใช่หรือไม่?
                <br />
                <span className="text-xs text-slate-500 mt-2 block bg-slate-50 p-3 rounded-xl border border-slate-100">
                  ⚠️ ข้อมูลใบชั่งทั้งหมด <strong className="text-rose-600 font-semibold">{tickets.length.toLocaleString()} รายการ</strong> จะถูกนำออกจากหน้าจอ
                  <br />
                  (คุณสามารถกดปุ่ม <strong className="text-amber-800 font-medium">"ทดลองด้วยข้อมูลตัวอย่าง (Demo 565 บิล)"</strong> หรืออัปโหลดไฟล์ Excel ใหม่ได้ตลอดเวลา)
                </span>
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  id="btn-cancel-clear-modal"
                  type="button"
                  onClick={() => setShowClearConfirmModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-confirm-clear-modal"
                  type="button"
                  onClick={handleConfirmClearData}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm shadow-xs transition cursor-pointer"
                >
                  ยืนยันล้างข้อมูล
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Single Ticket Confirmation Modal */}
      <AnimatePresence>
        {ticketToDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setTicketToDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative"
            >
              <button
                onClick={() => setTicketToDelete(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">
                ยืนยันการลบใบชั่ง
              </h3>

              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                คุณต้องการลบใบชั่งเลขที่{' '}
                <strong className="text-rose-600 font-semibold font-mono">
                  {ticketToDelete.ticketNumber}
                </strong>{' '}
                ใช่หรือไม่?
                <br />
                <span className="text-xs text-slate-500 mt-2 block bg-slate-50 p-3 rounded-xl border border-slate-100">
                  วันที่ {ticketToDelete.dateIn} · ทะเบียน {ticketToDelete.plateNumber} ·{' '}
                  {ticketToDelete.productName || 'ไม่ระบุสินค้า'}
                  <br />
                  การลบนี้ไม่สามารถย้อนกลับได้
                </span>
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  id="btn-cancel-delete-ticket-modal"
                  type="button"
                  onClick={() => setTicketToDelete(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  id="btn-confirm-delete-ticket-modal"
                  type="button"
                  onClick={handleConfirmDeleteTicket}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm shadow-xs transition cursor-pointer"
                >
                  ยืนยันลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            ระบบสรุปบิลตาชั่ง แพล้นคอนกรีตผสมเสร็จ · รองรับโปรแกรมตาชั่งใหม่ export xlsx/csv
          </div>
          <div className="text-slate-400">
            คำนวณอัตโนมัติ 2,350 กก./คิว · โม่ 6 ล้อ 11.50 บ./คิว · โม่ 10 ล้อ 9 บ./คิว · ปัดเศษ 0.5 คิว
          </div>
        </div>
      </footer>
    </div>
  );
}
