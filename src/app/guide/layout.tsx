import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Export Trades from IBKR, Schwab, TD, Webull | Flinch",
  description: "Step-by-step instructions to export your trade history CSV from Interactive Brokers, Charles Schwab, TD Ameritrade, and Webull for behavioral analysis.",
};

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
