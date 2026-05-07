// lib/payment-providers/pomelo.ts
//
// STATUS: SKELETON - Not functional. Pomelo.la is a card-issuing platform,
// not a payment acquirer. This file is a placeholder for a future card
// payment provider that supports checkout + webhooks in Argentina.
//
// TODO: Replace with a real acquirer API (e.g. Mobbex, Payway, or Pomelo
// if they release an acquiring product).
//
// When implementing, the provider must:
//   1. Accept amount, currency, splitId and return a checkout URL
//   2. Send a webhook to POST /webhooks/pomelo/:splitId on payment confirmation
//   3. Use HMAC-SHA256 signature verification (already implemented in the backend)
//
// Required env vars:
//   POMELO_API_KEY - API key for the payment provider
//   POMELO_SANDBOX  - "true" to use sandbox mode

'use server';

export async function createPomeloPayment(params: {
  amount: number;
  currency: 'ARS' | 'USD';
  splitId: string;
}): Promise<{ checkoutUrl: string }> {
  if (!process.env.POMELO_API_KEY) {
    throw new Error('Card payments are not configured. Set POMELO_API_KEY in your .env file.');
  }

  // TODO: Replace with real acquirer endpoint
  const response = await fetch('https://api.pomelo.la/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.POMELO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      description: `Migo Split ${params.splitId}`,
      callback_url: `${process.env.NEXT_PUBLIC_API_URL}/webhooks/pomelo/${params.splitId}`
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pomelo error: ${response.status} ${body}`);
  }

  const data = await response.json();
  return { checkoutUrl: data.checkout_url };
}
