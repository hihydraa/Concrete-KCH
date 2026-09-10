import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// If the env vars are not configured, `supabase` stays null and the app
// falls back to localStorage-only mode (see App.tsx) instead of crashing.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

if (!supabase) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ไม่ได้ตั้งค่า — ระบบทำงานในโหมด localStorage เดิม (ไม่ sync ข้ามเครื่อง)'
  );
}
