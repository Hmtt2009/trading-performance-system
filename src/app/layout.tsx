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
  title: "Trading Performance System",
  description:
    "Upload your trades. Detect behavioral patterns. Improve your edge.",
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
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}
