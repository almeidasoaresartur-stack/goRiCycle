import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { CookieConsent } from "@/components/CookieConsent";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
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
  title: "goRiCycle — Compara recondicionados em Portugal",
  description:
    "Compara preços de smartphones e tablets recondicionados nas melhores lojas portuguesas. iServices, Refurbed, Swappie, Certideal e Callphone num só sítio.",
  openGraph: {
    title: "goRiCycle — Compara recondicionados em Portugal",
    description:
      "Encontra o melhor preço em smartphones e tablets recondicionados em Portugal.",
    url: "https://goricycle.com",
    siteName: "goRiCycle",
    locale: "pt_PT",
    type: "website",
  },
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
        <GoogleAnalytics />
        <SiteHeader />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
