import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase の設定がありません（NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）",
    );
  }
  return createBrowserClient(url, key);
}
