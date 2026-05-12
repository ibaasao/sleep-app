import { HealingToneButton } from "@/components/HealingToneButton";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 py-8 sm:gap-10 sm:px-6 sm:py-16">
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
      <HealingToneButton email={user?.email ?? null} />
    </main>
  );
}
