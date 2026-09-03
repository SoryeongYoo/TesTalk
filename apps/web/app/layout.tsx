import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 오픽 모의고사",
  description: "AI 기반 오픽(OPIc) 모의고사 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
