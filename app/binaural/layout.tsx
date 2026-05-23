import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Binaural Beats — 無料・ログイン不要",
  description:
    "Delta / Theta / Alpha / Beta のバイナルビートをヘッドフォンで。アカウント不要のフリープレイヤー。",
};

export default function BinauralLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#030712] text-slate-200">{children}</div>
  );
}
