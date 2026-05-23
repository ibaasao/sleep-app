"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

/**
 * URL ハッシュ (#access_token=...) 形式の認証完了用フォールバック
 */
export default function AuthConfirmPage() {
  const [msg, setMsg] = useState("認証を確認しています…");

  useEffect(() => {
    const supabase = createClient();

    const finish = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (session) {
        window.location.replace("/");
        return;
      }

      if (error) {
        setMsg("認証に失敗しました。ログイン画面から再度お試しください。");
        setTimeout(() => {
          window.location.replace("/login?error=auth");
        }, 2000);
        return;
      }

      setMsg("セッションがありません。ログイン画面へ移動します…");
      setTimeout(() => {
        window.location.replace("/login");
      }, 1500);
    };

    void finish();
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#030712] px-6 text-center text-slate-300">
      <p>{msg}</p>
    </main>
  );
}
