import { supabase } from './supabaseClient';
import { PlantSettings, WeighTicket } from '../types';

const TICKETS_TABLE = 'tickets';
const SETTINGS_TABLE = 'plant_settings';
const SETTINGS_ROW_ID = 'default';

// Supabase/PostgREST caps how many rows can be sent in a single request;
// chunk large imports so a full re-import of 500+ bills doesn't fail outright.
const UPSERT_CHUNK_SIZE = 500;

function ticketToRow(t: WeighTicket) {
  return {
    ticket_number: t.ticketNumber,
    date_in: t.dateIn || null,
    time_in: t.timeIn,
    date_out: t.dateOut || null,
    time_out: t.timeOut,
    plate_number: t.plateNumber,
    plate_number_normalized: t.plateNumberNormalized,
    customer_name: t.customerName,
    product_name: t.productName,
    product_code: t.productCode || null,
    weight_in: t.weightIn,
    weight_out: t.weightOut,
    weight_net: t.weightNet,
    price: t.price,
    carrier_code: t.carrierCode,
    truck_number: t.truckNumber || null,
    driver_name: t.driverName || null,
    truck_type: t.truckType || null,
    matched_by: t.matchedBy,
    is_overridden: t.isOverridden ?? false,
    is_quantity_overridden: t.isQuantityOverridden ?? false,
    quantity: t.quantity,
    quantity_unit: t.quantityUnit,
    raw_quantity: t.rawQuantity,
    is_concrete: t.isConcrete,
    direction: t.direction,
    count_trip: t.countTrip,
    commission: t.commission,
    commission_type: t.commissionType || null,
    commission_rate: t.commissionRate ?? null,
    needs_audit: t.needsAudit,
    audit_reasons: t.auditReasons || [],
    updated_at: new Date().toISOString(),
  };
}

function rowToTicket(r: any): WeighTicket {
  return {
    ticketNumber: r.ticket_number,
    dateIn: r.date_in || '',
    timeIn: r.time_in || '',
    dateOut: r.date_out || '',
    timeOut: r.time_out || '',
    plateNumber: r.plate_number || '',
    plateNumberNormalized: r.plate_number_normalized || '',
    customerName: r.customer_name || '',
    productName: r.product_name || '',
    productCode: r.product_code || undefined,
    weightIn: Number(r.weight_in) || 0,
    weightOut: Number(r.weight_out) || 0,
    weightNet: Number(r.weight_net) || 0,
    price: Number(r.price) || 0,
    carrierCode: r.carrier_code || '',
    truckNumber: r.truck_number || undefined,
    driverName: r.driver_name || undefined,
    truckType: r.truck_type || undefined,
    matchedBy: r.matched_by || 'unmatched',
    isOverridden: r.is_overridden || false,
    isQuantityOverridden: r.is_quantity_overridden || false,
    quantity: Number(r.quantity) || 0,
    quantityUnit: r.quantity_unit || '',
    rawQuantity: Number(r.raw_quantity) || 0,
    isConcrete: r.is_concrete || false,
    direction: r.direction || 'in',
    countTrip: r.count_trip ?? true,
    commission: Number(r.commission) || 0,
    commissionType: r.commission_type || undefined,
    commissionRate: r.commission_rate != null ? Number(r.commission_rate) : undefined,
    needsAudit: r.needs_audit || false,
    auditReasons: r.audit_reasons || [],
  };
}

export async function fetchAllTickets(): Promise<WeighTicket[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TICKETS_TABLE)
    .select('*')
    .order('date_in', { ascending: true })
    .order('time_in', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToTicket);
}

export async function upsertTickets(tickets: WeighTicket[]): Promise<void> {
  if (!supabase || tickets.length === 0) return;
  for (let i = 0; i < tickets.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = tickets.slice(i, i + UPSERT_CHUNK_SIZE).map(ticketToRow);
    const { error } = await supabase.from(TICKETS_TABLE).upsert(chunk, { onConflict: 'ticket_number' });
    if (error) throw error;
  }
}

export async function deleteTickets(ticketNumbers: string[]): Promise<void> {
  if (!supabase || ticketNumbers.length === 0) return;
  const { error } = await supabase.from(TICKETS_TABLE).delete().in('ticket_number', ticketNumbers);
  if (error) throw error;
}

export async function deleteAllTickets(): Promise<void> {
  if (!supabase) return;
  // Supabase requires a filter on delete; this condition matches every row.
  const { error } = await supabase.from(TICKETS_TABLE).delete().neq('ticket_number', '__none__');
  if (error) throw error;
}

export async function fetchSettings(): Promise<PlantSettings | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('data')
    .eq('id', SETTINGS_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as PlantSettings) || null;
}

export async function saveSettings(settings: PlantSettings): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(
      { id: SETTINGS_ROW_ID, data: settings, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) throw error;
}
