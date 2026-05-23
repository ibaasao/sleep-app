"use client";

import { getAuthCallbackUrl } from "@/lib/authRedirect";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

function isMobileUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorReason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /** スマホはメールリンクが別ブラウザで開きやすいためパスワードを既定 */
  const [mode, setMode] = useState<"magic" | "password">("password");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isMobileUa()) {
      setMode("password");
    }
  }, []);

  async function onSubmitMagic(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const redirectTo = getAuthCallbackUrl();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    setLoading(false);
    if (err) {
      setMessage(err.message);
      return;
    }
    setMessage(
      "ログイン用のリンクをメールに送りました。リンクはこのスマホのブラウザ（Safari / Chrome）で開いてください。Gmail アプリ内ブラウザだとログインできないことがあります。",
    );
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (err) {
      setMessage(err.message);
      return;
    }
    if (!data.session) {
      setMessage(
        "セッションを取得できませんでした。メール確認が必要なアカウントの場合は、受信箱のリンクからログインしてください。",
      );
      return;
    }
    /** フルリロードでサーバー側 Cookie / ミドルウェアと同期（モバイル向け） */
    window.location.assign("/");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-white">ログイン</h1>
        <p className="mt-2 text-sm text-slate-400">
          Supabase アカウントでサインインします
        </p>
      </div>

      {error === "auth" && (
        <p className="text-center text-sm text-rose-400" role="alert">
          認証に失敗しました。
          {errorReason === "exchange" || errorReason === "verify"
            ? "メールのリンクを、ログインを始めたのと同じブラウザ（Safari 等）で開いてください。"
            : "もう一度お試しください。スマホでは「メール＋パスワード」が確実です。"}
        </p>
      )}

      {isMobileUa() && mode === "password" ? (
        <p className="max-w-sm text-center text-xs leading-relaxed text-slate-500">
          スマホではメールリンクより「メール＋パスワード」でのログインをおすすめします。
        </p>
      ) : null}

      <div className="flex gap-2 rounded-full bg-slate-800/80 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("magic");
            setMessage(null);
          }}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "magic"
              ? "bg-violet-500 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          メールリンク
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setMessage(null);
          }}
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "password"
              ? "bg-violet-500 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          メール＋パスワード
        </button>
      </div>

      {mode === "magic" ? (
        <form
          onSubmit={onSubmitMagic}
          className="flex w-full max-w-sm flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-left text-sm text-slate-300">
            メールアドレス
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-violet-600 px-4 py-3 font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "送信中…" : "ログインリンクを送る"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={onSubmitPassword}
          className="flex w-full max-w-sm flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-left text-sm text-slate-300">
            メールアドレス
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-left text-sm text-slate-300">
            パスワード
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-violet-600 px-4 py-3 font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      )}

      {message && (
        <p
          className={`max-w-sm text-center text-sm ${
            message.includes("送りました") ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {message}
        </p>
      )}

      <Link
        href="/"
        className="text-sm text-violet-300 underline-offset-4 hover:underline"
      >
        トップに戻る
      </Link>
    </main>
  );
}
