import { DownloadAppPage } from "@/components/download/DownloadAppPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "アプリをダウンロード — 睡眠改善サウンド",
  description:
    "Sleep Sound をホーム画面に追加。一度ログインすれば、次からは自動で使えます。",
};

export default function DownloadPage() {
  return <DownloadAppPage />;
}
