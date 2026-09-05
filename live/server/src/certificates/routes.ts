import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

function validHmac(rawBody: Buffer, received: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]!);
}

export function registerCertificateRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  webhookSecret: string | null,
  storageDirectory: string,
): void {
  if (webhookSecret) {
    app.register(async scope => {
      scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
      scope.post('/webhooks/shopify/orders-fulfilled', async (request, reply) => {
        const signature = request.headers['x-shopify-hmac-sha256'];
        const webhookId = request.headers['x-shopify-webhook-id'];
        const topic = request.headers['x-shopify-topic'];
        const shopDomain = request.headers['x-shopify-shop-domain'];
        if (typeof signature !== 'string' || typeof webhookId !== 'string') {
          return reply.code(400).send({ error: 'missing_signature' });
        }
        const rawBody = request.body as Buffer;
        if (!validHmac(rawBody, signature, webhookSecret)) {
          return reply.code(401).send({ error: 'bad_signature' });
        }
        if (topic !== 'orders/fulfilled') return reply.code(400).send({ error: 'wrong_topic' });
        let payload: unknown;
        try { payload = JSON.parse(rawBody.toString('utf8')); }
        catch { return reply.code(400).send({ error: 'invalid_json' }); }
        const result = await pool.query(`
          INSERT INTO shopify_webhooks (webhook_id, topic, shop_domain, payload)
          VALUES ($1,$2,$3,$4) ON CONFLICT (webhook_id) DO NOTHING`,
        [webhookId, topic, typeof shopDomain === 'string' ? shopDomain : null, JSON.stringify(payload)]);
        return reply.code(202).send({ received: true, duplicate: result.rowCount === 0 });
      });
    });
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  app.get<{ Params: { token: string } }>('/certificates/:token', async (request, reply) => {
    if (!uuidPattern.test(request.params.token)) return reply.code(404).type('text/plain').send('Certificate not found');
    const { rows } = await pool.query(`SELECT certificate_number, product_title, brand, sku, image_urls,
      order_name, issued_at, status FROM authenticity_certificates WHERE token=$1`, [request.params.token]);
    const certificate = rows[0];
    if (!certificate) return reply.code(404).type('text/plain').send('Certificate not found');
    const status = certificate.status === 'active' ? 'ACTIVE' : 'REVOKED';
    const statusColor = certificate.status === 'active' ? '#16794b' : '#b42318';
    const images = (certificate.image_urls as string[]).slice(0, 3).map(url =>
      `<img src="${escapeHtml(url)}" alt="Authenticated product photograph">`).join('');
    return reply.type('text/html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(certificate.certificate_number)}</title>
      <style>body{margin:0;background:#f5f5f2;color:#10141f;font-family:Arial,sans-serif}.card{max-width:820px;margin:38px auto;background:white;border:1px solid #0e1b4d;padding:42px}.brand{color:#0e1b4d;font-weight:800;letter-spacing:.1em}.status{display:inline-block;margin-top:24px;color:white;background:${statusColor};padding:7px 10px;font-size:12px;font-weight:800;letter-spacing:.1em}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:28px 0}.photos img{width:100%;height:240px;object-fit:contain;background:#f2f3f6}.meta{display:grid;grid-template-columns:1fr 1fr;gap:16px}.label{color:#6b7280;font-size:11px;font-weight:800;letter-spacing:.08em}.value{font-size:16px;margin-top:4px}.button{display:inline-block;margin-top:28px;background:#0e1b4d;color:white;text-decoration:none;padding:14px 18px;font-size:12px;font-weight:800;letter-spacing:.08em}@media(max-width:640px){.card{margin:0;padding:24px;border-width:0}.photos{grid-template-columns:1fr}.photos img{height:300px}.meta{grid-template-columns:1fr}}</style></head>
      <body><main class="card"><div class="brand">CIRCULAR FASH</div><div class="status">${status}</div>
      <h1>Certificate of Authenticity</h1><p>${escapeHtml(certificate.certificate_number)}</p>
      <div class="photos">${images}</div><h2>${escapeHtml(certificate.product_title)}</h2>
      <div class="meta"><div><div class="label">BRAND</div><div class="value">${escapeHtml(certificate.brand || 'Not specified')}</div></div>
      <div><div class="label">SKU</div><div class="value">${escapeHtml(certificate.sku || 'Not specified')}</div></div>
      <div><div class="label">ORDER</div><div class="value">${escapeHtml(certificate.order_name)}</div></div>
      <div><div class="label">ISSUED</div><div class="value">${new Date(certificate.issued_at).toISOString().slice(0, 10)}</div></div></div>
      <a class="button" href="/certificates/${request.params.token}.pdf">DOWNLOAD PDF</a></main></body></html>`);
  });

  app.get<{ Params: { token: string } }>('/certificates/:token.pdf', async (request, reply) => {
    if (!uuidPattern.test(request.params.token)) return reply.code(404).type('text/plain').send('Certificate PDF not found');
    const { rows } = await pool.query(`SELECT certificate_number, pdf_path FROM authenticity_certificates WHERE token=$1`, [request.params.token]);
    const certificate = rows[0];
    if (!certificate?.pdf_path) return reply.code(404).type('text/plain').send('Certificate PDF not found');
    const filename = path.basename(certificate.pdf_path);
    return reply
      .type('application/pdf')
      .header('Content-Disposition', `inline; filename="${certificate.certificate_number}.pdf"`)
      .send(createReadStream(path.join(storageDirectory, filename)));
  });
}
