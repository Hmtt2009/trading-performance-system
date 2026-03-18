import { Whop } from '@whop/sdk';

let whopClient: Whop | null = null;

export function getWhopClient(): Whop {
  if (whopClient) return whopClient;

  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) throw new Error('WHOP_API_KEY environment variable not configured');

  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
  if (!webhookSecret && process.env.NODE_ENV === 'production') {
    throw new Error('WHOP_WEBHOOK_SECRET is required in production');
  }

  // SDK requires "Bearer " prefix on the API key
  const formattedKey = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;

  whopClient = new Whop({
    apiKey: formattedKey,
    webhookKey: webhookSecret ?? null,
  });

  return whopClient;
}
