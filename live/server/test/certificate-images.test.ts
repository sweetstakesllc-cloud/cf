import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopifyAdminClient } from '../src/certificates/shopify.js';

afterEach(() => vi.unstubAllGlobals());

function mockGallery(gallery: string[], pageSize = 250) {
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    const { query, variables } = JSON.parse(options.body);
    expect(query).toContain('images(first: 250, after: $cursor)');
    const start = Number(variables.cursor ?? 0);
    const end = Math.min(start + pageSize, gallery.length);
    return new Response(JSON.stringify({ data: { product: {
      title: 'Test item', vendor: 'Test brand', partner: null, reportNumber: null,
      images: { nodes: gallery.slice(start, end).map(url => ({ url })),
        pageInfo: { hasNextPage: end < gallery.length, endCursor: String(end) } },
    } } }));
  }));
}

describe('certificate listing photographs', () => {
  it.each([
    ['long gallery', ['front', 'side', 'back', 'tag', 'label'], ['front', 'tag', 'label']],
    ['three photos', ['front', 'tag', 'label'], ['front', 'tag', 'label']],
    ['two photos', ['front', 'label'], ['front', 'label']],
    ['one photo', ['front'], ['front']],
    ['no photos', [], []],
  ])('selects the overview and final details for %s', async (_name, gallery, expected) => {
    mockGallery(gallery);
    const product = await new ShopifyAdminClient('example.myshopify.com', 'test-token').getProduct('123');
    expect(product?.imageUrls).toEqual(expected);
  });

  it('finds the final label photos beyond the first page', async () => {
    mockGallery(['front', 'side', 'back', 'tag', 'label'], 2);
    const product = await new ShopifyAdminClient('example.myshopify.com', 'test-token').getProduct('123');
    expect(product?.imageUrls).toEqual(['front', 'tag', 'label']);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
