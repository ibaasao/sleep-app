import { HomeSessionBlock } from "@/components/HomeSessionBlock";
import { SleepDataDashboard } from "@/components/SleepDataDashboard";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let email: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  } catch (err) {
    console.error("[Home] Supabase session unavailable", err);
  }

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
      </div>
      <div
        id="quick-mood-root"
        className="w-full max-w-3xl shrink-0"
      />
      <HomeSessionBlock email={email} />
      <SleepDataDashboard isLoggedIn={email != null} />
    </main>
  );
}
