"use client";

import { isAndroid, isIos, isStandalonePwa } from "@/lib/pwa/detect";
import Link from "next/link";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const ACCENT = "#DEFF9A";

export function DownloadAppPage() {
  const [standalone, setStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installMsg, setInstallMsg] = useState<string | null>(null);

  useEffect(() => {
    setStandalone(isStandalonePwa());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  async function installAndroid() {
    if (!deferredPrompt) {
      setInstallMsg("Chrome でこのページを開き、メニューから「アプリをインストール」を選んでください。");
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      setInstallMsg("インストールを開始しました。ホーム画面のアイコンから開けます。");
    }
  }

  return (
    <main className="min-h-dvh bg-[#030712] text-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(124,58,237,0.2),transparent_55%)]" />

      <div className="relative mx-auto max-w-lg px-5 pb-16 pt-12">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-violet-400/80">
          Sleep Sound App
        </p>
        <h1 className="mt-3 text-center text-3xl font-bold text-white">
          アプリをダウンロード
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-400">
          ホーム画面に追加すると、ブラウザのバーなしで開けます。
          <strong className="font-medium text-slate-300">
            {" "}
            一度ログインすれば、次からは自動でログイン状態が続きます。
          </strong>
        </p>

        <div
          className="mx-auto mt-8 flex h-28 w-28 items-center justify-center rounded-3xl shadow-[0_0_48px_-8px_rgba(124,58,237,0.6)]"
          style={{
            background: "linear-gradient(135deg, #1e1b4b, #030712)",
            border: `1px solid ${ACCENT}33`,
          }}
        >
          <span className="text-2xl font-bold" style={{ color: ACCENT }}>
            528
          </span>
        </div>

        {standalone ? (
          <div className="mt-10 space-y-4 text-center">
            <p className="text-sm text-emerald-300/90">
              すでにアプリとしてインストール済みです
            </p>
            <Link
              href="/"
              className="inline-block w-full max-w-xs rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-center text-sm font-semibold text-white"
            >
              アプリを開く
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {isAndroid() || deferredPrompt ? (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-sm font-semibold text-white">Android</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  下のボタンでインストールできます（Chrome 推奨）
                </p>
                <button
                  type="button"
                  onClick={() => void installAndroid()}
                  className="mt-4 w-full rounded-xl py-3.5 text-sm font-semibold text-slate-950"
                  style={{ background: ACCENT }}
                >
                  アプリをインストール
                </button>
              </section>
            ) : null}

            {isIos() || (!isAndroid() && !deferredPrompt) ? (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-sm font-semibold text-white">iPhone / iPad</h2>
                <ol className="mt-3 list-inside list-decimal space-y-2 text-xs leading-relaxed text-slate-400">
                  <li>
                    <strong className="text-slate-300">Safari</strong>
                    でこのページを開く
                  </li>
                  <li>
                    画面下の <strong className="text-slate-300">共有</strong>
                    （□に↑）をタップ
                  </li>
                  <li>
                    <strong className="text-slate-300">
                      ホーム画面に追加
                    </strong>
                    を選ぶ
                  </li>
                  <li>ホーム画面の「Sleep Sound」アイコンから起動</li>
                </ol>
              </section>
            ) : null}

            <section className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-5">
              <h2 className="text-sm font-semibold text-violet-200">
                ログインについて
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                初回だけメール（またはID）とパスワードの登録が必要です。
                インストール後はログイン情報が端末に保存され、
                いちいちログインを聞かれずに使えます。
              </p>
              <Link
                href="/login"
                className="mt-4 inline-block text-sm font-medium text-violet-300 underline-offset-2 hover:underline"
              >
                先にアカウント登録 / ログイン →
              </Link>
            </section>

            <Link
              href="/"
              className="block w-full rounded-xl border border-slate-700 py-3 text-center text-sm text-slate-300 transition hover:bg-slate-800/50"
            >
              ブラウザのまま使う
            </Link>
          </div>
        )}

        {installMsg ? (
          <p className="mt-4 text-center text-xs text-emerald-300/90">{installMsg}</p>
        ) : null}

        <p className="mt-10 text-center text-[11px] text-slate-600">
          <Link href="/" className="underline-offset-2 hover:underline">
            トップへ戻る
          </Link>
          {" · "}
          <Link href="/binaural" className="underline-offset-2 hover:underline">
            バイナルビート（ログイン不要）
          </Link>
        </p>
      </div>
    </main>
  );
}
