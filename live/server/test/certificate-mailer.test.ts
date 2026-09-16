import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendCertificateMailer } from '../src/certificates/mailer.js';
import type { CertificateRecord } from '../src/certificates/types.js';

afterEach(() => vi.unstubAllGlobals());

describe('certificate email delivery', () => {
  it('includes an individual link for every item in both HTML and plain text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const certificates: CertificateRecord[] = ['Jacket', 'Bag'].map((title, i) => ({
      token: `token-${i}`, certificateNumber: `CF-${i}`, orderName: '#100', productTitle: title,
      brand: 'Brand', sku: '', imageUrls: [], authenticationPartner: null,
      authenticationReportNumber: null, issuedAt: new Date(), pdfPath: `${i}.pdf`, status: 'active',
    }));
    await new ResendCertificateMailer('test-key', 'test@example.com').sendCertificateEmail({
      email: 'buyer@example.com', orderName: '#100', certificates,
      publicBaseUrl: 'https://certificates.example.com', idempotencyKey: 'request-test',
    });
    const options = fetchMock.mock.calls[0]![1];
    const body = JSON.parse(options.body);
    expect(body.to).toEqual(['buyer@example.com']);
    expect(body.subject).toBe('Certificate of Authenticity – Order #100');
    expect(fetchMock).toHaveBeenCalledOnce();
    for (const certificate of certificates) {
      const url = `https://certificates.example.com/certificates/${certificate.token}.pdf`;
      expect(body.html).toContain(url);expect(body.text).toContain(url);
      expect(body.text).toContain(certificate.productTitle);
    }
    expect(options.headers['Idempotency-Key']).toBe('request-test');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports provider failure without storing the provider response or customer email', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private customer details', { status: 429 })));
    await expect(new ResendCertificateMailer('test-key', 'test@example.com').sendCertificateEmail({
      email: 'buyer@example.com', orderName: '#100', certificates: [],
      publicBaseUrl: 'https://certificates.example.com', idempotencyKey: 'request-test',
    })).rejects.toThrow('Certificate email failed (429)');
  });
});
