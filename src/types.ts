export type ProductDirection = 'out' | 'in' | 'internal';

export type CommissionType = 'per_cue' | 'per_trip';

export type CueRounding = '0.5' | '0.25' | '1.0' | 'none';

export interface ProductConfig {
  id: string;
  code: string; // รหัสสินค้า e.g. ST180คิว, ST210คิว, แก๊ส, ทราย, etc.
  name: string; // ชื่อสินค้า e.g. คอนกรีต ST180 (คิว), แก๊ส, etc.
  unit: string;
  kgPerUnit: number;
  direction: ProductDirection;
  countTrip: boolean;
  category: 'concrete' | 'sand' | 'stone' | 'cement' | 'laterite' | 'other';
}

export interface TruckConfig {
  plateNumber: string;
  truckNumber: string;
  truckType: 'โม่ 6 ล้อ' | 'โม่ 10 ล้อ' | '6 ล้อพ่วง' | 'เซมิดั้ม' | '6 ล้อดั้ม' | 'อื่นๆ';
  driverName: string;
  commissionType: CommissionType;
  commissionRate: number; // Baht per cue or Baht per trip
  carrierCode?: string; // Optional legacy reference
  isInternal?: boolean;
}

export interface CarrierDriverConfig {
  id?: string;
  carrierCode: string; // รหัสผู้ขนส่งจากไฟล์ Excel (เช่น D01, D02 หรือชื่อคนขับ)
  driverName: string;  // พนักงานขับรถในระบบ
  note?: string;
}

export interface WeighTicket {
  ticketNumber: string;
  dateIn: string;        // YYYY-MM-DD
  timeIn: string;        // HH:mm
  dateOut: string;       // YYYY-MM-DD
  timeOut: string;       // HH:mm
  plateNumber: string;
  plateNumberNormalized: string;
  customerName: string;
  productName: string;
  productCode?: string; // รหัสสินค้า e.g. ST180คิว, ST210คิว, etc.
  weightIn: number;      // kg
  weightOut: number;     // kg
  weightNet: number;     // kg |weightIn - weightOut|
  price: number;
  carrierCode: string;   // รหัสผู้ขนส่ง
  
  // Derived / Calculated fields
  truckNumber?: string;
  driverName?: string;
  truckType?: string;
  matchedBy: 'code' | 'plate' | 'manual' | 'driver' | 'unmatched';
  isOverridden?: boolean;
  isQuantityOverridden?: boolean;
  quantity: number;      // คิว or ตัน
  quantityUnit: string;  // คิว or ตัน
  rawQuantity: number;
  isConcrete: boolean;
  direction: ProductDirection;
  countTrip: boolean;
  commission: number;    // Calculated commission
  commissionType?: CommissionType;
  commissionRate?: number;
  
  // Audit flags
  needsAudit: boolean;
  auditReasons: string[];
}

export interface DriverSummary {
  driverName: string;
  carrierCode?: string;
  truckNumber: string;
  plateNumber: string;
  truckType: string;
  trucksDriven?: string[];
  commissionType: CommissionType;
  commissionRate: number;
  totalTrips: number;
  totalCues: number;
  totalWeightTon: number;
  totalCommission: number;
  matchedFromCodeCount: number;
  matchedFromPlateCount: number;
  dailyTrips: {
    date: string;
    tripIndex: number;
    cumulativeTrip: number;
    destination: string;
    grade: string;
    cues: number;
    cumulativeCues: number;
    commission: number;
    ticketNumber: string;
    timeOut: string;
    plateNumber: string;
    truckNumber: string;
    truckType: string;
  }[];
}

export interface DailySummary {
  date: string;
  totalTickets: number;
  concreteTickets: number;
  totalConcreteCues: number;
  rawMaterialTons: number;
  byTruck: {
    truckNumber: string;
    plateNumber: string;
    driverName: string;
    truckType: string;
    trips: number;
    cues: number;
  }[];
  byGrade: {
    grade: string;
    trips: number;
    cues: number;
  }[];
  diff: number; // Truck sum cues - Grade sum cues
}

export interface PlantSettings {
  cueRounding: CueRounding;
  products: ProductConfig[];
  trucks: TruckConfig[];
  carrierDrivers: CarrierDriverConfig[];
  distanceTiers: {
    maxKm: number;
    rate: number;
    label: string;
  }[];
}
