import { AuthNav } from "@/components/AuthNav";
import { HealingToneButton } from "@/components/HealingToneButton";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
          sleep sound
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          DNA修復 528Hz
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300">
          オフタイマーと再生ボタンで、時間が来ると音がフェードアウトして止まります。初回はブラウザの許可で音声が有効になります。ログインすると再生開始が記録されます。
        </p>
        <div className="mt-6 flex justify-center">
          <AuthNav email={user?.email ?? null} />
        </div>
      </div>
      <HealingToneButton />
    </main>
  );
}
