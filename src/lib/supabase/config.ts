// These are public-facing values safe to expose in the browser.
// Supabase uses Row Level Security (RLS) to protect data, not key secrecy.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://btkvovgfsrfvikktoyun.supabase.co";

export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_DX_rhmM7MvAdk6DxFhDt6g_dtv0UBS9";
