import type { Metadata } from "next";
import { Space_Mono, Bebas_Neue, Syne } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { AppShell } from "@/components/AppShell";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-space-mono",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas-neue",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trading Journal & Behavioral Pattern Detector | Flinch",
  description: "Stop losing money to bad habits. Flinch analyzes your trade data to expose behavioral patterns like revenge trading, overtrading, and premature exits. Upload your CSV from any US broker. Free to start.",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Trading Journal & Behavioral Pattern Detector | Flinch",
    description: "Stop losing money to bad habits. Flinch analyzes your trade data to expose behavioral patterns like revenge trading, overtrading, and premature exits.",
    url: "https://flinch.cards",
    siteName: "Flinch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trading Journal & Behavioral Pattern Detector | Flinch",
    description: "Stop losing money to bad habits. Flinch analyzes your trade data to expose behavioral patterns like revenge trading, overtrading, and premature exits.",
  },
  keywords: [
    "trading journal",
    "trading performance system",
    "behavioral trading patterns",
    "revenge trading detector",
    "trading psychology tool",
    "trade analysis tool",
    "overtrading detection",
    "trading journal alternative",
    "TradeZella alternative",
    "automated trading journal",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${spaceMono.variable} ${bebasNeue.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Flinch",
              "applicationCategory": "FinanceApplication",
              "operatingSystem": "Web",
              "url": "https://flinch.cards",
              "description": "AI-powered trading journal that automatically detects behavioral patterns costing traders money.",
              "offers": {
                "@type": "Offer",
                "price": "19.00",
                "priceCurrency": "USD"
              }
            })
          }}
        />
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}
