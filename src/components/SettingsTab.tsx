import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Check,
  Save,
  FileSpreadsheet,
  Truck,
  Layers,
  HelpCircle,
  X,
  AlertTriangle,
} from 'lucide-react';
import { CueRounding, PlantSettings, ProductConfig, TruckConfig, CarrierDriverConfig } from '../types';
import { defaultSettings } from '../data/masterSettings';
import { exportMasterSettingsToExcel } from '../utils/excelParser';

interface SettingsTabProps {
  settings: PlantSettings;
  setSettings: React.Dispatch<React.SetStateAction<PlantSettings>>;
  onSettingsUpdated: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  setSettings,
  onSettingsUpdated,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'trucks' | 'rules'>('products');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Rounding options
  const roundingOptions: { id: CueRounding; label: string; desc: string }[] = [
    { id: '0.5', label: 'ปัดทีละ 0.5 คิว (ค่าเริ่มต้น)', desc: 'ปัดเศษเข้าหา 0.5 ที่ใกล้ที่สุด เช่น 3.3 -> 3.5, 3.2 -> 3.0' },
    { id: '0.25', label: 'ปัดทีละ 0.25 คิว', desc: 'ปัดเศษเข้าหา 0.25 เช่น 3.12 -> 3.25' },
    { id: '1.0', label: 'ปัดเป็นจำนวนเต็ม (1.0)', desc: 'ปัดเศษเป็นคิวเต็ม เช่น 3.4 -> 3.0, 3.6 -> 4.0' },
    { id: 'none', label: 'ไม่ปัดเศษ (ทศนิยม 2 ตำแหน่ง)', desc: 'แสดงค่าคิวจริงจากการคำนวณ นน. / 2,350' },
  ];

  const handleUpdateRounding = (val: CueRounding) => {
    setSettings((prev) => ({ ...prev, cueRounding: val }));
    triggerSaved();
    onSettingsUpdated();
  };

  const handleResetDefaults = () => {
    setConfirmDialog({
      title: 'รีเซ็ตการตั้งค่าทั้งหมด',
      message: 'คุณต้องการรีเซ็ตการตั้งค่าสินค้า รถ/คนขับ และกฎการคำนวณทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?',
      confirmText: 'รีเซ็ตกลับค่าเริ่มต้น',
      onConfirm: () => {
        setSettings(defaultSettings);
        triggerSaved();
        onSettingsUpdated();
      },
    });
  };

  const triggerSaved = () => {
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  const handleUpdateProduct = (idx: number, field: keyof ProductConfig, val: any) => {
    setSettings((prev) => {
      const nextProds = [...prev.products];
      nextProds[idx] = { ...nextProds[idx], [field]: val };
      return { ...prev, products: nextProds };
    });
    triggerSaved();
    onSettingsUpdated();
  };

  const handleAddProduct = () => {
    const newId = 'prod_' + Date.now();
    const newProd: ProductConfig = {
      id: newId,
      code: 'NEW' + (settings.products.length + 1),
      name: 'สินค้าใหม่ ' + (settings.products.length + 1),
      unit: 'คิว',
      kgPerUnit: 2350,
      direction: 'out',
      countTrip: true,
      category: 'concrete',
    };
    setSettings((prev) => ({
      ...prev,
      products: [newProd, ...prev.products],
    }));
    triggerSaved();
    onSettingsUpdated();
  };

  const handleDeleteProduct = (idx: number) => {
    const p = settings.products[idx];
    setConfirmDialog({
      title: 'ยืนยันการลบสินค้า',
      message: `คุณต้องการลบสินค้า "${p.name}" ออกจากรายการสินค้าหรือไม่?`,
      confirmText: 'ลบสินค้า',
      onConfirm: () => {
        setSettings((prev) => ({
          ...prev,
          products: prev.products.filter((_, i) => i !== idx),
        }));
        triggerSaved();
        onSettingsUpdated();
      },
    });
  };

  const handleUpdateTruck = (idx: number, field: keyof TruckConfig, val: any) => {
    setSettings((prev) => {
      const nextTrucks = [...prev.trucks];
      nextTrucks[idx] = { ...nextTrucks[idx], [field]: val };
      return { ...prev, trucks: nextTrucks };
    });
    triggerSaved();
    onSettingsUpdated();
  };

  const handleAddTruck = () => {
    const newTruck: TruckConfig = {
      plateNumber: '',
      truckNumber: `${settings.trucks.length + 1}`,
      truckType: 'โม่ 10 ล้อ',
      commissionType: 'per_cue',
      commissionRate: 9.0,
      driverName: 'พนักงานขับรถใหม่',
      isInternal: true,
    };
    setSettings((prev) => ({
      ...prev,
      trucks: [...prev.trucks, newTruck],
    }));
    triggerSaved();
    onSettingsUpdated();
  };

  const handleDeleteTruck = (idx: number) => {
    const t = settings.trucks[idx];
    setConfirmDialog({
      title: 'ยืนยันการลบรถ',
      message: `คุณต้องการลบข้อมูลรถ "${t.plateNumber || 'ไม่ระบุทะเบียน'} (${t.driverName})"?`,
      confirmText: 'ลบรายการ',
      onConfirm: () => {
        setSettings((prev) => ({
          ...prev,
          trucks: prev.trucks.filter((_, i) => i !== idx),
        }));
        triggerSaved();
        onSettingsUpdated();
      },
    });
  };

  const handleUpdateCarrierDriver = (idx: number, field: keyof CarrierDriverConfig, val: any) => {
    setSettings((prev) => {
      const nextList = [...(prev.carrierDrivers || [])];
      nextList[idx] = { ...nextList[idx], [field]: val };
      return { ...prev, carrierDrivers: nextList };
    });
    triggerSaved();
    onSettingsUpdated();
  };

  const handleAddCarrierDriver = () => {
    const newCD: CarrierDriverConfig = {
      carrierCode: '',
      driverName: '',
      note: '',
    };
    setSettings((prev) => ({
      ...prev,
      carrierDrivers: [...(prev.carrierDrivers || []), newCD],
    }));
    triggerSaved();
    onSettingsUpdated();
  };

  const handleDeleteCarrierDriver = (idx: number) => {
    const cd = (settings.carrierDrivers || [])[idx];
    setConfirmDialog({
      title: 'ยืนยันการลบรหัสผู้ขนส่ง',
      message: `คุณต้องการลบการจับคู่ "${cd.carrierCode} ➔ ${cd.driverName || 'ไม่ระบุ'}" ออกจากระบบหรือไม่?`,
      confirmText: 'ลบรายการ',
      onConfirm: () => {
        setSettings((prev) => ({
          ...prev,
          carrierDrivers: (prev.carrierDrivers || []).filter((_, i) => i !== idx),
        }));
        triggerSaved();
        onSettingsUpdated();
      },
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-300">
              การตั้งค่ามาสเตอร์ (master_ตั้งค่าระบบ)
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            ตั้งค่าตารางสินค้า · ทะเบียนรถ · อัตราค่าคอม · การปัดเศษ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            เมื่อแก้ไขในหน้านี้ ระบบจะบันทึกและคำนวณบิลใหม่ทันที และสามารถดาวน์โหลดเป็นไฟล์ master_ตั้งค่าระบบ.xlsx ได้
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportMasterSettingsToExcel(settings)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-medium shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export master_ตั้งค่าระบบ.xlsx</span>
          </button>

          <button
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium border border-slate-200 transition cursor-pointer"
            title="รีเซ็ตค่ามาตรฐานเดิม"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>รีเซ็ต</span>
          </button>
        </div>
      </div>

      {showSavedToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-center gap-2 shadow-xs"
        >
          <Check className="w-4 h-4 text-emerald-600" />
          <span>บันทึกการตั้งค่าและปรับปรุงการคำนวณเรียบร้อยแล้ว</span>
        </motion.div>
      )}

      {/* Sub-tab navigation */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setActiveSubTab('products')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeSubTab === 'products'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>สินค้า & อัตราแปลง (ชีท transfer)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('trucks')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeSubTab === 'trucks'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>รถ · คนขับ · รหัสผู้ขนส่ง (ชีท truck / carrier_driver)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rules')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeSubTab === 'rules'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>การปัดเศษคิว & ค่าเที่ยวระยะทาง</span>
        </button>
      </div>

      {/* SUB-TAB 1: Products & Transfer Rates */}
      {activeSubTab === 'products' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                ตารางสินค้าและอัตราแปลง กก./หน่วย ({settings.products.length} รายการ)
              </h3>
              <p className="text-xs text-slate-500">
                คอนกรีต = 2,350 กก./คิว · ทราย = 1,630 กก./คิว · หิน/ลูกรัง = 1,550 กก./คิว · วัตถุดิบตัน = 1,000 กก./ตัน
              </p>
            </div>
            <button
              onClick={handleAddProduct}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มสินค้าใหม่</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">รหัสสินค้า</th>
                  <th className="py-2.5 px-3">ชื่อสินค้า</th>
                  <th className="py-2.5 px-3">หน่วย</th>
                  <th className="py-2.5 px-3">กก. / หน่วย</th>
                  <th className="py-2.5 px-3">ทิศทาง</th>
                  <th className="py-2.5 px-3">นับเที่ยว</th>
                  <th className="py-2.5 px-3">หมวดหมู่</th>
                  <th className="py-2.5 px-3 text-center w-12">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settings.products.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 w-36">
                      <input
                        type="text"
                        value={p.code || ''}
                        placeholder="รหัสสินค้า"
                        onChange={(e) => handleUpdateProduct(idx, 'code', e.target.value)}
                        className="bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-amber-500 rounded px-2 py-1 font-mono text-xs text-amber-900 font-semibold w-full"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleUpdateProduct(idx, 'name', e.target.value)}
                        className="bg-transparent border border-transparent hover:border-slate-300 focus:border-amber-500 rounded px-2 py-1 font-medium text-slate-900 w-full"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={p.unit}
                        onChange={(e) => handleUpdateProduct(idx, 'unit', e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
                      >
                        <option value="คิว">คิว</option>
                        <option value="ตัน">ตัน</option>
                        <option value="กก.">กก.</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        value={p.kgPerUnit}
                        onChange={(e) =>
                          handleUpdateProduct(idx, 'kgPerUnit', Number(e.target.value) || 1000)
                        }
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-900 font-mono w-24 text-right"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={p.direction}
                        onChange={(e) => handleUpdateProduct(idx, 'direction', e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
                      >
                        <option value="out">ออก (ขาย)</option>
                        <option value="in">เข้า (รับซื้อ)</option>
                        <option value="internal">ภายใน</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={p.countTrip}
                        onChange={(e) => handleUpdateProduct(idx, 'countTrip', e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={p.category}
                        onChange={(e) => handleUpdateProduct(idx, 'category', e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs"
                      >
                        <option value="concrete">คอนกรีต</option>
                        <option value="sand">ทราย</option>
                        <option value="stone">หิน</option>
                        <option value="cement">ปูนผง</option>
                        <option value="laterite">ลูกรัง</option>
                        <option value="other">อื่นๆ</option>
                      </select>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteProduct(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="ลบสินค้านี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Trucks & Carrier Drivers & Commission Rates */}
      {activeSubTab === 'trucks' && (
        <div className="space-y-6">
          {/* Card 1: ตาราง รถ คนขับ ค่าคอม (ทะเบียนรถ ผูกกับ เบอร์รถ กับ ประเภทรถ กับ วิธีคิดค่าคอม กับ อัตรา (บาท) กับ คนขับ) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                      ตารางที่ 1
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      ตารางรถ · คนขับ · ค่าคอมมิชชั่น
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    ผูก <strong>ทะเบียนรถ</strong> ↔ <strong>เบอร์รถ</strong> ↔ <strong>ประเภทรถ</strong> ↔ <strong>วิธีคิดค่าคอม</strong> ↔ <strong>อัตรา (บาท)</strong> ↔ <strong>คนขับ</strong>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    * ใช้คำนวณอัตราค่าคอมมิชชั่น และใช้ระบุคนขับกรณีที่บิลตาชั่งไม่ได้ระบุรหัสผู้ขนส่ง
                  </p>
                </div>
                <button
                  onClick={handleAddTruck}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer self-start md:self-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรถใหม่</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto px-4 py-3">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">ทะเบียนรถ</th>
                    <th className="py-2.5 px-3">เบอร์รถ</th>
                    <th className="py-2.5 px-3">ประเภทรถ</th>
                    <th className="py-2.5 px-3">วิธีคิดค่าคอม</th>
                    <th className="py-2.5 px-3 text-right">อัตรา (บาท)</th>
                    <th className="py-2.5 px-3">คนขับประจำรถ</th>
                    <th className="py-2.5 px-3 text-center w-12">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settings.trucks.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={t.plateNumber}
                          onChange={(e) => handleUpdateTruck(idx, 'plateNumber', e.target.value)}
                          placeholder="เช่น 83-2051"
                          className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 font-mono font-medium text-slate-900 w-32"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={t.truckNumber}
                          onChange={(e) => handleUpdateTruck(idx, 'truckNumber', e.target.value)}
                          placeholder="เช่น 9"
                          className="bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-slate-900 w-20"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={t.truckType}
                          onChange={(e) => handleUpdateTruck(idx, 'truckType', e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
                        >
                          <option value="โม่ 6 ล้อ">โม่ 6 ล้อ</option>
                          <option value="โม่ 10 ล้อ">โม่ 10 ล้อ</option>
                          <option value="6 ล้อพ่วง">6 ล้อพ่วง</option>
                          <option value="เซมิดั้ม">เซมิดั้ม</option>
                          <option value="6 ล้อดั้ม">6 ล้อดั้ม</option>
                          <option value="อื่นๆ">อื่นๆ</option>
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={t.commissionType}
                          onChange={(e) => handleUpdateTruck(idx, 'commissionType', e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium"
                        >
                          <option value="per_cue">ต่อคิว</option>
                          <option value="per_trip">ต่อเที่ยว</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.5"
                          value={t.commissionRate}
                          onChange={(e) =>
                            handleUpdateTruck(idx, 'commissionRate', Number(e.target.value) || 0)
                          }
                          className="bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono text-slate-900 w-24 text-right"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={t.driverName}
                          onChange={(e) => handleUpdateTruck(idx, 'driverName', e.target.value)}
                          placeholder="ชื่อ-สกุลคนขับ"
                          className="bg-transparent border border-transparent hover:border-slate-300 focus:border-amber-500 rounded px-2 py-1 font-semibold text-slate-900 w-48"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDeleteTruck(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="ลบรายการรถนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: ตารางรหัสผู้ขนส่ง , คนขับ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      ตารางที่ 2 (Priority 1)
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      ตารางรหัสผู้ขนส่ง ↔ คนขับ
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    การนำเข้าไฟล์บิลตาชั่ง <strong>ให้ระบุ คนขับ จาก รหัสผู้ขนส่ง ในไฟล์ก่อนเสมอ</strong> หากในไฟล์ไม่ได้ระบุ จึงดึงเอาจากตาราง ทะเบียนรถ ด้านบน
                  </p>
                </div>
                <button
                  onClick={handleAddCarrierDriver}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition cursor-pointer self-start md:self-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรหัสผู้ขนส่ง</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto px-4 py-3">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-44">รหัสผู้ขนส่งในไฟล์ Excel</th>
                    <th className="py-2.5 px-3">พนักงานขับรถ</th>
                    <th className="py-2.5 px-3">หมายเหตุ / สายงาน</th>
                    <th className="py-2.5 px-3 text-center w-12">ลบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(settings.carrierDrivers || []).map((cd, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={cd.carrierCode}
                          onChange={(e) => handleUpdateCarrierDriver(idx, 'carrierCode', e.target.value)}
                          placeholder="เช่น จตุพล หัสดี หรือ รหัสในไฟล์"
                          className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 font-mono font-bold text-emerald-900 w-40"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={cd.driverName}
                          onChange={(e) => handleUpdateCarrierDriver(idx, 'driverName', e.target.value)}
                          placeholder="ชื่อ-สกุลพนักงานขับรถ"
                          className="bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 rounded px-2 py-1 font-semibold text-slate-900 w-64"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={cd.note || ''}
                          onChange={(e) => handleUpdateCarrierDriver(idx, 'note', e.target.value)}
                          placeholder="เช่น พนักงานขับรถประจำ"
                          className="bg-transparent border border-transparent hover:border-slate-300 focus:border-slate-400 rounded px-2 py-1 text-slate-500 text-xs w-full"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDeleteCarrierDriver(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="ลบรหัสผู้ขนส่งนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!settings.carrierDrivers || settings.carrierDrivers.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                        ยังไม่มีข้อมูลในตารางรหัสผู้ขนส่ง กดปุ่ม "+ เพิ่มรหัสผู้ขนส่ง" ด้านบนเพื่อเพิ่ม
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Rounding Rules & Distance Tiers */}
      {activeSubTab === 'rules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cue Rounding Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                การปัดเศษคิวคอนกรีต (Cue Rounding)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                ตามข้อกำหนดใน Section 7: แพล้นคอนกรีตเดิมใช้การปัดทีละ 0.5 คิว
              </p>
            </div>

            <div className="space-y-3">
              {roundingOptions.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer ${
                    settings.cueRounding === opt.id
                      ? 'border-amber-500 bg-amber-50/60'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cueRounding"
                    value={opt.id}
                    checked={settings.cueRounding === opt.id}
                    onChange={() => handleUpdateRounding(opt.id)}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-900">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Distance Tiers for Trailer Trucks */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                อัตราค่าเที่ยวรถพ่วงตามระยะทาง (Distance Tiers)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                ตาม Section 3.3: ไม่เกิน 100 กม. (80 บาท) · ไม่เกิน 300 กม. (200 บาท) · เกิน 300 กม. (400 บาท)
              </p>
            </div>

            <div className="space-y-3">
              {settings.distanceTiers.map((tier, idx) => (
                <div
                  key={tier.label}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-xs sm:text-sm text-slate-800">
                      {tier.label}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      ระยะทางสูงสุด {tier.maxKm > 1000 ? 'มากกว่า 300 กม.' : `${tier.maxKm} กม.`}
                    </span>
                  </div>
                  <div className="text-right font-mono font-bold text-amber-900 text-sm sm:text-base">
                    ฿{tier.rate}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
              <span className="font-semibold">ข้อสังเกตจาก Section 9 ข้อ 5:</span> บิลตาชั่งส่วนใหญ่ยังไม่ระบุระยะทาง ระบบจึงใช้อัตรา 80 บาท/เที่ยวเป็นค่ามาตรฐาน และสามารถแยกอัตราเพิ่มเติมได้ในอนาคต
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (iframe-safe) */}
      <AnimatePresence>
        {confirmDialog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setConfirmDialog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative"
            >
              <button
                onClick={() => setConfirmDialog(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {confirmDialog.title}
              </h3>

              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                {confirmDialog.message}
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm shadow-xs transition cursor-pointer"
                >
                  {confirmDialog.confirmText || 'ยืนยัน'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
