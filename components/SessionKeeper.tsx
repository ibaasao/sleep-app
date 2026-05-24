"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

/**
 * PWA / モバイルでセッションを維持（タブ復帰・定期リフレッシュ）
 */
export function SessionKeeper() {
  useEffect(() => {
    const supabase = createClient();

    const refresh = () => {
      void supabase.auth.getSession();
    };

    refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(refresh, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
