"use client";

import { signInWithLoginId, signUpWithLoginId } from "@/lib/auth/credentials";
import { loginIdHint, sanitizeLoginIdInput } from "@/lib/auth/loginId";
import Link from "next/link";
import { type FormEvent, useState } from "react";

type Mode = "login" | "register";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none ring-violet-500/0 transition placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/30";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const id = sanitizeLoginIdInput(loginId);
    if (id !== loginId) {
      setLoginId(id);
    }

    if (mode === "register" && password !== passwordConfirm) {
      setLoading(false);
      setMessage("パスワード（確認）が一致しません。");
      return;
    }

    const result =
      mode === "register"
        ? await signUpWithLoginId(id, password)
        : await signInWithLoginId(id, password);

    setLoading(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/[0.08] bg-[#030712]/95 p-6 shadow-[0_0_60px_-20px_rgba(124,58,237,0.5)] sm:p-8">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-400/80">
              Sleep Sound
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">
              {mode === "login" ? "ログイン" : "新規登録"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {mode === "login"
                ? "メールアドレス（またはログインID）とパスワードで入れます。"
                : "ブラウザにおすすめされたメール・パスワードをそのまま使ってOKです。"}
            </p>
          </div>

          <div className="mt-6 flex rounded-xl bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-violet-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setMessage(null);
              }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-violet-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              新規登録
            </button>
          </div>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="mt-6 space-y-4"
            autoComplete="on"
          >
            <label className="block text-sm text-slate-300">
              メールアドレス / ログインID
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                enterKeyHint="next"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="ibarakiasao4717@gmail.com"
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-slate-500">
                {loginIdHint()}
              </span>
            </label>

            <label className="block text-sm text-slate-300">
              パスワード
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                enterKeyHint="done"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            {mode === "register" ? (
              <label className="block text-sm text-slate-300">
                パスワード（確認）
                <input
                  type="password"
                  name="password-confirm"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className={inputClass}
                />
              </label>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50"
            >
              {loading
                ? "処理中…"
                : mode === "login"
                  ? "ログイン"
                  : "登録してはじめる"}
            </button>
          </form>

          {message ? (
            <p
              className="mt-4 text-center text-sm leading-relaxed text-rose-300"
              role="alert"
            >
              {message}
            </p>
          ) : null}

          {mode === "register" ? (
            <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
              登録すると睡眠ログの保存・マイページ分析が使えます。
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-violet-300 underline-offset-4 hover:underline"
          >
            ログインせずにトップへ
          </Link>
        </p>
      </div>
    </main>
  );
}
