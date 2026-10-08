import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { CookieConsent } from "@/components/CookieConsent";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SiteHeader } from "@/components/SiteHeader";
import { VercelAnalytics } from "@/components/VercelAnalytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "Preços de telemóveis e tablets recondicionados | goRiCycle";
const SITE_DESCRIPTION =
  "Compara preços de iPhone, iPad e Samsung recondicionados na iServices, Refurbed, Swappie, Certideal e Callphone. Preços atualizados diariamente.";

export const metadata: Metadata = {
  metadataBase: new URL("https://goricycle.com"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "goRiCycle",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
        <VercelAnalytics />
        <SiteHeader />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
