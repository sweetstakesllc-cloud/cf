import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShopifyAdminClient } from '../src/certificates/shopify.js';

test('Shopify credentials share a token and renew before expiry; failed exchanges retry', async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 100000;
  let exchanges = 0;
  let fail = false;
  Date.now = () => now;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/oauth/access_token')) {
      exchanges++;
      if (fail) return new Response('{}', { status: 401 });
      const params = options?.body as URLSearchParams;
      assert.equal(params.get('client_id'), 'id');
      assert.equal(params.get('client_secret'), 'secret');
      return Response.json({ access_token: `token-${exchanges}`, expires_in: 120 });
    }
    assert.equal((options?.headers as Record<string, string>)['X-Shopify-Access-Token'], `token-${exchanges}`);
    return Response.json({ data: { product: null } });
  };
  try {
    const client = new ShopifyAdminClient('example.myshopify.com', { clientId: 'id', clientSecret: 'secret' });
    await Promise.all([client.getProduct('1'), client.getProduct('2')]);
    assert.equal(exchanges, 1);
    now += 59000;
    await client.getProduct('1');
    assert.equal(exchanges, 1);
    now += 2000;
    await client.getProduct('1');
    assert.equal(exchanges, 2);
    now += 61000;
    fail = true;
    await assert.rejects(client.getProduct('1'), /token exchange returned 401/);
    fail = false;
    await client.getProduct('1');
    assert.equal(exchanges, 4);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
