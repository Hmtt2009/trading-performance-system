import { Whop } from '@whop/sdk';

let whopClient: Whop | null = null;

export function getWhopClient(): Whop {
  if (whopClient) return whopClient;

  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) throw new Error('WHOP_API_KEY environment variable not configured');

  whopClient = new Whop({
    apiKey,
    webhookKey: process.env.WHOP_WEBHOOK_SECRET ?? null,
  });

  return whopClient;
}
