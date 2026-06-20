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
  metadataBase: new URL("https://goricycle.com"),
  title: "goRiCycle — Compara recondicionados em Portugal",
  description:
    "Compara preços de smartphones e tablets recondicionados nas melhores lojas portuguesas. iServices, Refurbed, Swappie, Certideal e Callphone num só sítio.",
  openGraph: {
    type: "website",
    siteName: "goRiCycle",
    title: "goRiCycle — Comparador de smartphones e tablets recondicionados",
    description:
      "Descobre em primeira mão a melhor opção em segunda mão. Compara preços de iPhone, Samsung e Google recondicionados nas principais lojas portuguesas.",
    url: "https://goricycle.com",
    locale: "pt_PT",
    images: [
      {
        url: "/images/goricycle-logo.png",
        alt: "goRiCycle — comparador de preços de smartphones e tablets recondicionados em Portugal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "goRiCycle — Comparador de smartphones e tablets recondicionados",
    description: "Descobre em primeira mão a melhor opção em segunda mão.",
    images: ["/images/goricycle-logo.png"],
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
