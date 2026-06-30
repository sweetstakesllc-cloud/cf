/**
 * Minimal Shopify Storefront GraphQL client.
 *
 * Reads credentials from env (Expo inlines EXPO_PUBLIC_* at build time):
 *   EXPO_PUBLIC_SHOPIFY_DOMAIN        e.g. circularfash.com  (or *.myshopify.com)
 *   EXPO_PUBLIC_SHOPIFY_TOKEN         the Storefront API public access token
 *   EXPO_PUBLIC_SHOPIFY_API_VERSION   optional, defaults below
 *
 * The Storefront token is publishable — safe to ship in a client. Do NOT put the
 * Admin API token here. See .env.example.
 */

const DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN;
const TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_TOKEN;
const API_VERSION = process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION || '2026-04';

/** True only when both domain + token are present — the seam uses this to decide
 *  between live Storefront data and the bundled catalog snapshot. */
export const shopifyConfigured = Boolean(DOMAIN && TOKEN);

export async function storefront<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  if (!shopifyConfigured) {
    throw new Error(
      'Shopify not configured — set EXPO_PUBLIC_SHOPIFY_DOMAIN and EXPO_PUBLIC_SHOPIFY_TOKEN in .env'
    );
  }

  const res = await fetch(`https://${DOMAIN}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN as string,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Storefront API HTTP ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new Error(`Storefront API errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}
