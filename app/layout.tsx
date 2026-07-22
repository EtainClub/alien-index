import type { Metadata, Viewport } from "next";
import { sitePath } from "@/lib/site-path";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alien Index — 외계인 지수",
  description: "당신 안의 외계인 바이브를 측정하는 1분 성향 테스트",
  applicationName: "Alien Index",
  manifest: sitePath("/manifest.webmanifest"),
  icons: {
    icon: sitePath("/icon.svg"),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Alien Index",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#090b10" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
