import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, AlertTriangle, CheckCircle2, Truck, Calendar, Clock, DollarSign, Scale } from 'lucide-react';
import { PlantSettings, WeighTicket } from '../types';
import { enrichTicket, matchDriverFromCarrierCode } from '../utils/textNormalizer';

interface TicketDetailModalProps {
  ticket: WeighTicket | null;
  settings: PlantSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTicket: WeighTicket) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  settings,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !ticket) return null;

  const [customerName, setCustomerName] = useState(ticket.customerName || '');
  const [productName, setProductName] = useState(ticket.productName || '');
  const [plateNumber, setPlateNumber] = useState(ticket.plateNumber || '');
  const [carrierCode, setCarrierCode] = useState(ticket.carrierCode || '');
  const [overrideDriverName, setOverrideDriverName] = useState(ticket.driverName || '');
  const [customDriverName, setCustomDriverName] = useState('');
  const [isCustomDriver, setIsCustomDriver] = useState(false);
  const [weightIn, setWeightIn] = useState(ticket.weightIn);
  const [weightOut, setWeightOut] = useState(ticket.weightOut);
  const [dateIn, setDateIn] = useState(ticket.dateIn);
  const [timeIn, setTimeIn] = useState(ticket.timeIn);
  const [timeOut, setTimeOut] = useState(ticket.timeOut);
  const [quantity, setQuantity] = useState<number>(ticket.quantity);
  const [isQuantityOverridden, setIsQuantityOverridden] = useState<boolean>(
    ticket.isQuantityOverridden || false
  );

  const handleSave = () => {
    const finalDriver = isCustomDriver
      ? customDriverName.trim()
      : overrideDriverName.trim();

    const isManualDriver =
      finalDriver !== '' &&
      (finalDriver !== ticket.driverName || ticket.matchedBy === 'manual');

    // Resolve truck from plate number in settings (independent of driver)
    const truckByPlate = plateNumber
      ? settings.trucks.find(
          (t) => t.plateNumber.replace(/\D/g, '') === plateNumber.replace(/\D/g, '')
        )
      : undefined;

    const enriched = enrichTicket(
      {
        ...ticket,
        customerName,
        productName,
        plateNumber,
        carrierCode,
        driverName: finalDriver || undefined,
        truckNumber: truckByPlate ? truckByPlate.truckNumber : ticket.truckNumber,
        truckType: truckByPlate ? truckByPlate.truckType : ticket.truckType,
        matchedBy: isManualDriver ? 'manual' : ticket.matchedBy,
        isOverridden: isManualDriver,
        weightIn,
        weightOut,
        dateIn,
        timeIn,
        timeOut,
        quantity: isQuantityOverridden ? quantity : undefined,
        isQuantityOverridden,
      },
      settings
    );
    onSave(enriched);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden border border-slate-200"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                รายละเอียด & แก้ไขข้อมูลใบชั่ง
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-mono">
                {ticket.ticketNumber}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
            {ticket.needsAudit && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">รายการที่ระบบแจ้งเตือน:</span>
                  <ul className="list-disc list-inside mt-0.5 text-xs text-rose-800">
                    {ticket.auditReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">วันที่ชั่ง</label>
                <input
                  type="date"
                  value={dateIn}
                  onChange={(e) => setDateIn(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">เวลาเข้า</label>
                  <input
                    type="text"
                    value={timeIn}
                    onChange={(e) => setTimeIn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">เวลาออก</label>
                  <input
                    type="text"
                    value={timeOut}
                    onChange={(e) => setTimeOut(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">ทะเบียนรถ</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  รหัสผู้ขนส่ง
                  <span className="text-[10px] text-slate-400 font-normal ml-1">(ผู้รับงาน/ค่าเที่ยว)</span>
                </label>
                <input
                  type="text"
                  value={carrierCode}
                  placeholder="เช่น D01, 01, 04..."
                  onChange={(e) => {
                    const val = e.target.value;
                    setCarrierCode(val);
                    const found = settings.trucks.find(
                      (t) => t.carrierCode.toLowerCase() === val.toLowerCase().trim()
                    );
                    if (found) {
                      setOverrideDriverName(found.driverName);
                      setIsCustomDriver(false);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono"
                />
              </div>
            </div>

            {/* Driver assignment & vehicle swap override */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>พนักงานขับรถของบิลนี้ (เทียบเท่ารหัสผู้ขนส่ง)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-900 border border-amber-300">
                    {ticket.matchedBy === 'manual'
                      ? '✏️ แก้ไขคนขับเอง'
                      : ticket.matchedBy === 'driver'
                      ? '✓ ระบุจากคอลัมน์คนขับ'
                      : ticket.matchedBy === 'code'
                      ? '✓ รหัสผู้ขนส่ง'
                      : '⚠️ ดึงจากทะเบียนรถประจำ'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCustomDriver(!isCustomDriver)}
                    className="text-[11px] text-amber-700 hover:text-amber-800 underline font-medium cursor-pointer"
                  >
                    {isCustomDriver ? 'เลือกจากรายชื่อ' : '+ พิมพ์ชื่อใหม่'}
                  </button>
                </div>
              </div>

              {isCustomDriver ? (
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อพนักงานขับรถ..."
                  value={customDriverName}
                  onChange={(e) => setCustomDriverName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              ) : (
                <select
                  value={overrideDriverName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOverrideDriverName(val);
                    const found = settings.trucks.find((t) => t.driverName === val);
                    if (found?.carrierCode) {
                      setCarrierCode(found.carrierCode);
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- ไม่ระบุคนขับ --</option>
                  {settings.trucks.map((t) => (
                    <option key={t.driverName} value={t.driverName}>
                      {t.driverName} {t.carrierCode ? `[รหัสผู้ขนส่ง: ${t.carrierCode}]` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[10px] text-slate-500">
                💡 การระบุพนักงานขับรถของบิลนี้เทียบเท่ากับการกำหนด <strong>"รหัสผู้ขนส่ง"</strong> เพื่อคิดค่าเที่ยว/ค่าคอม โดย<strong>ไม่ผูกมัด</strong>กับทะเบียนหรือประเภทรถของบิล พนักงานสามารถสลับขับรถคันใดก็ได้ตามหน้างานจริง
              </p>
            </div>

            {/* Editable Quantity / Number of Cues (Requirement 2) */}
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-amber-950 font-semibold text-xs flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-700" />
                  <span>จำนวนคิว / ปริมาณสินค้า ({ticket.quantityUnit})</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isQuantityOverridden}
                      onChange={(e) => {
                        setIsQuantityOverridden(e.target.checked);
                        if (!e.target.checked) {
                          // Recalculate auto quantity
                          const net = Math.abs(weightIn - weightOut);
                          const kg = ticket.isConcrete ? 2350 : 1000;
                          const raw = kg > 0 ? net / kg : 0;
                          setQuantity(ticket.isConcrete ? Math.round(raw * 2) / 2 : Math.round(raw * 100) / 100);
                        }
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                    />
                    <span className="font-medium">กำหนดจำนวนคิวเอง</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={!isQuantityOverridden}
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className={`w-full border rounded-xl px-3 py-2 text-slate-900 font-mono font-bold text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isQuantityOverridden
                      ? 'bg-white border-amber-400 text-amber-900 ring-1 ring-amber-300'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                />
                <span className="text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">
                  {ticket.quantityUnit}
                </span>
              </div>
              <p className="text-[10px] text-amber-800">
                {isQuantityOverridden
                  ? '✓ โหมดกำหนดเอง: จำนวนคิวนี้จะถูกบันทึกและเชื่อมโยงไปยังทั้งหน้าสรุปบิลประจำวันและข้อมูลดิบ'
                  : '* โหมดคำนวณอัตโนมัติ: คำนวณจาก นน.สุทธิ ÷ อัตราแปลง (ติ๊ก "กำหนดจำนวนคิวเอง" เพื่อแก้ไข)'}
              </p>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">ลูกค้า / หน่วยงาน</label>
              <input
                type="text"
                value={customerName}
                placeholder="ระบุชื่อลูกค้าหรือโครงการ"
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">สินค้า / เกรดคอนกรีต</label>
              <input
                type="text"
                list="product-options"
                value={productName}
                placeholder="เช่น คอนกรีต ST240 (คิว), ทราย(ผลิต)กก...."
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium"
              />
              <datalist id="product-options">
                {settings.products.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.code ? `[${p.code}] ${p.name}` : p.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-slate-600 font-medium mb-1">นน.เข้า (กก.)</label>
                <input
                  type="number"
                  value={weightIn}
                  onChange={(e) => setWeightIn(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-right"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">นน.ออก (กก.)</label>
                <input
                  type="number"
                  value={weightOut}
                  onChange={(e) => setWeightOut(Number(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-right"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">นน.สุทธิ (กก.)</label>
                <div className="w-full bg-slate-100 rounded-xl px-3 py-2 text-slate-900 font-mono text-right font-bold">
                  {Math.abs(weightIn - weightOut).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Calculated summary preview */}
            <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-600">คนขับที่จับคู่:</span>{' '}
                <span className="font-bold text-slate-900">
                  {ticket.driverName} (เบอร์ {ticket.truckNumber})
                </span>
              </div>
              <div>
                <span className="text-slate-600">จำนวนคำนวณ:</span>{' '}
                <span className="font-bold text-amber-900 font-mono">
                  {ticket.quantity.toFixed(1)} {ticket.quantityUnit}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-medium text-xs sm:text-sm transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs sm:text-sm shadow-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการแก้ไข</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
