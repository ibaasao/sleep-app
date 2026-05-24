import { HomeSessionBlock } from "@/components/HomeSessionBlock";
import { SleepDataDashboard } from "@/components/SleepDataDashboard";
import { getSessionUser } from "@/lib/auth/getSessionUser";

export default async function Home() {
  const sessionUser = await getSessionUser();

  return (
    <main className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-start gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pb-20 sm:pt-10">
      <div className="session-intro w-full max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400 sm:text-sm">
          sleep sound
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
          DNA修復 528Hz
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
          オフタイマーと再生ボタンで、時間が来ると音がフェードアウトして止まります。初回はブラウザの許可で音声が有効になります。ログインすると再生開始が記録されます。
        </p>
        <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
          <a
            href="/download"
            className="rounded-full bg-[#DEFF9A]/15 px-4 py-1.5 text-sm font-semibold text-[#DEFF9A] ring-1 ring-[#DEFF9A]/30 transition hover:bg-[#DEFF9A]/25"
          >
            📲 アプリをダウンロード（おすすめ）
          </a>
          <a
            href="#sleep-dashboard"
            className="text-sm font-medium text-violet-300 underline-offset-4 hover:text-violet-200 hover:underline"
          >
            ↓ 睡眠データ分析へ
          </a>
          <a
            href="/binaural"
            className="text-sm font-medium text-cyan-300/90 underline-offset-4 hover:text-cyan-200 hover:underline"
          >
            バイナルビート（ログイン不要）
          </a>
        </div>
      </div>
      <div
        id="quick-mood-root"
        className="w-full max-w-3xl shrink-0"
      />
      <SleepDataDashboard isLoggedIn={sessionUser != null} />
      <HomeSessionBlock loginId={sessionUser?.loginId ?? null} />
    </main>
  );
}
