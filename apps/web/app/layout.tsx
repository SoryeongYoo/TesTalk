import type { Metadata } from "next";
import "./globals.css";
import { AuthStatus } from "@/components/auth/AuthStatus";

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
      <body>
        <header className="flex items-center justify-end border-b border-slate-200 px-6 py-3">
          <AuthStatus />
        </header>
        {children}
      </body>
    </html>
  );
}
