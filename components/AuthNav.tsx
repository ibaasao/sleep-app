"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  loginId: string | null;
};

export function AuthNav({ loginId }: Props) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <nav className="flex flex-wrap items-center justify-center gap-3 text-sm">
      {loginId ? (
        <>
          <span className="max-w-[220px] truncate text-slate-400" title={loginId}>
            ID: {loginId}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full border border-slate-600 px-3 py-1 text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/80"
          >
            ログアウト
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className="rounded-full bg-slate-800/90 px-4 py-1.5 font-medium text-violet-200 ring-1 ring-white/10 transition hover:bg-slate-700/90"
        >
          ログイン
        </Link>
      )}
    </nav>
  );
}
