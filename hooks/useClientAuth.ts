"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

/**
 * サーバー判定とクライアント Supabase セッションを同期する。
 */
export function useClientAuth(serverLoggedIn: boolean) {
  const [loggedIn, setLoggedIn] = useState(serverLoggedIn);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const sync = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setLoggedIn(!!user);
      setReady(true);
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, [serverLoggedIn]);

  return { loggedIn, authReady: ready };
}
