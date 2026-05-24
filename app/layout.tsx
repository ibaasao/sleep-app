import { PwaRegister } from "@/components/PwaRegister";
import { SessionKeeper } from "@/components/SessionKeeper";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const THEME_COLOR = "#030712";

export const metadata: Metadata = {
  title: "睡眠改善サウンド",
  description: "DNA修復 528Hz",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sleep Sound",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
        <SessionKeeper />
        <PwaRegister />
      </body>
    </html>
  );
}
