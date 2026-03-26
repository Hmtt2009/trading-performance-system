import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — $19/mo Trading Journal | Flinch",
  description: "Flinch Pro: $19/mo with 7-day free trial. Automatic behavioral pattern detection, AI coaching debriefs, and edge scorecard. No credit card required to start.",
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
