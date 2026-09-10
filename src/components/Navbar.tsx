import React from 'react';
import { motion } from 'motion/react';
import {
  FileSpreadsheet,
  BarChart3,
  CalendarDays,
  Coins,
  Database,
  Sliders,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

export type ActiveTab = 'import' | 'dashboard' | 'daily' | 'commission' | 'raw' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  totalTickets: number;
  auditCount: number;
  dateRangeLabel: string;
  onQuickLoadSample: () => void;
  onClearData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalTickets,
  auditCount,
  dateRangeLabel,
  onQuickLoadSample,
  onClearData,
}) => {
  const tabs = [
    { id: 'import' as ActiveTab, label: 'นำเข้าไฟล์', icon: Upload },
    { id: 'dashboard' as ActiveTab, label: 'แดชบอร์ดภาพรวม', icon: BarChart3 },
    { id: 'daily' as ActiveTab, label: 'สรุปบิลประจำวัน', icon: CalendarDays },
    { id: 'commission' as ActiveTab, label: 'ค่าคอมมิชชั่นรายบุคคล', icon: Coins },
    { id: 'raw' as ActiveTab, label: 'ข้อมูลดิบ & ตรวจสอบ', icon: Database, badge: auditCount > 0 ? auditCount : undefined },
    { id: 'settings' as ActiveTab, label: 'ตั้งค่าระบบ', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs print:hidden">
      {/* Top utility bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white shadow-sm font-bold text-lg">
              CP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base sm:text-lg text-slate-900 tracking-tight">
                  ระบบสรุปบิลตาชั่ง แพล้นคอนกรีต
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  Ready-Mix Plant
                </span>
              </div>
              <p className="text-xs text-slate-500">
                สรุปเที่ยว · คิวคอนกรีต · ค่าคอมมิชชั่นคนขับ · รายงานบิลประจำวัน
              </p>
            </div>
          </div>

          {/* Quick Info & Actions */}
          <div className="flex items-center gap-3">
            {dateRangeLabel && (
              <div className="hidden md:flex items-center gap-2 text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                <span>{dateRangeLabel}</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{totalTickets.toLocaleString()} บิล</span>
            </div>

            {totalTickets > 0 && onClearData && (
              <button
                id="btn-navbar-clear-data"
                onClick={onClearData}
                className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                title="ล้างข้อมูลใบชั่งทั้งหมดออกจากระบบ"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>ล้างข้อมูล</span>
              </button>
            )}

            {auditCount > 0 && (
              <button
                id="btn-audit-badge"
                onClick={() => setActiveTab('raw')}
                className="flex items-center gap-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-800 px-3 py-1.5 rounded-lg border border-rose-200 font-medium transition cursor-pointer"
                title="คลิกเพื่อตรวจสอบรายการที่มีปัญหา"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                <span>เตือน {auditCount} รายการ</span>
              </button>
            )}

            {totalTickets === 0 && (
              <button
                id="btn-quick-sample"
                onClick={onQuickLoadSample}
                className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg font-medium shadow-xs transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>โหลดข้อมูลตัวอย่าง</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar py-2 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'text-amber-900 bg-amber-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-slate-500'}`} />
                <span>{tab.label}</span>

                {tab.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-rose-600 text-white">
                    {tab.badge}
                  </span>
                )}

                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
