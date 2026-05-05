import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-slate-400">
          読み込み中…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
