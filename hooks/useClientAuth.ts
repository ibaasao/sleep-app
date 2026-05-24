"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

/**
 * サーバー判定とクライアント Supabase セッションを同期。
 * authReady になるまで「未ログイン」UI を出さない（PWA でのちらつき防止）
 */
export function useClientAuth(serverLoggedIn: boolean) {
  const [loggedIn, setLoggedIn] = useState(serverLoggedIn);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const sync = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setLoggedIn(!!session?.user);
      setReady(true);
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setLoggedIn(!!session?.user);
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [serverLoggedIn]);

  return { loggedIn, authReady: ready };
}
