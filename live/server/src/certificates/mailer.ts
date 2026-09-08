import type { CertificateMailer, CertificateRecord } from './types.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[char]!);
}

function certificateRow(certificate: CertificateRecord, baseUrl: string): string {
  const image = certificate.imageUrls[0]
    ? `<img src="${escapeHtml(certificate.imageUrls[0])}" alt="" width="112" style="display:block;width:112px;height:140px;object-fit:contain;background:#f2f3f6">`
    : '<div style="width:112px;height:140px;background:#f2f3f6"></div>';
  return `<tr>
    <td style="padding:18px 0;border-top:1px solid #d9dce5;width:128px;vertical-align:top">${image}</td>
    <td style="padding:18px 0;border-top:1px solid #d9dce5;vertical-align:top">
      <div style="font:700 11px Arial,sans-serif;letter-spacing:.12em;color:#6b7280">${escapeHtml(certificate.certificateNumber)}</div>
      <div style="font:700 19px Arial,sans-serif;color:#10141f;padding:8px 0 4px">${escapeHtml(certificate.productTitle)}</div>
      <div style="font:14px Arial,sans-serif;color:#4b5563;padding-bottom:16px">${escapeHtml(certificate.brand)}</div>
      <a href="${baseUrl}/certificates/${certificate.token}.pdf" style="display:inline-block;background:#0e1b4d;color:#fff;text-decoration:none;font:700 11px Arial,sans-serif;letter-spacing:.1em;padding:12px 17px">DOWNLOAD CERTIFICATE</a>
    </td>
  </tr>`;
}

export class ConsoleCertificateMailer implements CertificateMailer {
  async sendCertificateEmail(input: { email: string; orderName: string; certificates: CertificateRecord[] }): Promise<void> {
    console.log(`[certificate-mailer] ${input.certificates.length} certificate(s) for ${input.orderName} -> ${input.email}`);
  }
}

export class ResendCertificateMailer implements CertificateMailer {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async sendReviewNotification(input: { id: string; orderName: string; email: string; reason: string }, recipient: string, storeDomain: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `certificate-review-${input.id}` },
      body: JSON.stringify({ from: this.from, to: [recipient], subject: `Certificate request ${input.orderName} needs review`,
        text: `A customer requested a certificate.\n\nOrder: ${input.orderName}\nCheckout email supplied: ${input.email}\nReview reason: ${input.reason}\nRequest ID: ${input.id}\n\nCheck the order and email in Shopify before issuing. No certificate has been sent for this request.\nhttps://${storeDomain}/admin/orders?query=${encodeURIComponent(input.orderName)}\n\nAsk your certificate administrator to review this request, or use the certificate-requests.ts operator command documented in CERTIFICATE-DEPLOY.md.` }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Review notification failed (${response.status})`);
  }

  async sendCertificateEmail(input: {
    email: string;
    orderName: string;
    certificates: CertificateRecord[];
    publicBaseUrl: string;
    idempotencyKey: string;
  }): Promise<void> {
    const rows = input.certificates.map(certificate => certificateRow(certificate, input.publicBaseUrl)).join('');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.email],
        subject: `Your Circular Fash authenticity certificate${input.certificates.length === 1 ? '' : 's'}`,
        html: `<!doctype html><html><body style="margin:0;background:#f4f4f1">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;padding:34px">
            <tr><td><div style="font:700 15px Arial,sans-serif;color:#0e1b4d;letter-spacing:.08em">CIRCULAR FASH</div>
            <h1 style="font:700 27px Arial,sans-serif;color:#10141f;margin:28px 0 10px">Your authenticity certificate${input.certificates.length === 1 ? '' : 's'}</h1>
            <p style="font:15px/1.55 Arial,sans-serif;color:#4b5563;margin:0 0 24px">Thank you for your purchase ${escapeHtml(input.orderName)}. Your item${input.certificates.length === 1 ? ' has' : 's have'} been authenticated and the permanent certificate${input.certificates.length === 1 ? ' is' : 's are'} ready below.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
            <p style="font:12px/1.5 Arial,sans-serif;color:#6b7280;margin:26px 0 0">This is a service email relating to your purchase, not a marketing subscription.</p>
            </td></tr></table></td></tr></table></body></html>`,
      }),
    });
    if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}
