import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "goRiCycle — Descobre a melhor opção em segunda mão",
  description:
    "Compara preços de smartphones e tablets recondicionados em iServices, Refurbed, Swappie, Certideal e Callphone. Preços transparentes, graus normalizados, links diretos.",
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[#F8FAFC] text-slate-900">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
