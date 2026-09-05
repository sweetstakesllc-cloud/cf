export interface Mailer {
  sendOtp(email: string, code: string): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  async sendOtp(email: string, code: string): Promise<void> {
    console.log(`[mailer] OTP for ${email}: ${code}`);
  }
}

export class ResendOtpMailer implements Mailer {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async sendOtp(email: string, code: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [email],
        subject: `${code} is your Circular Fash sign-in code`,
        html: `<!doctype html><html><body style="margin:0;background:#f4f4f1;font-family:Arial,sans-serif">
          <div style="max-width:520px;margin:28px auto;background:#fff;padding:34px;color:#10141f">
            <div style="font-weight:700;color:#0e1b4d;letter-spacing:.08em">CIRCULAR FASH</div>
            <h1 style="font-size:24px;margin:28px 0 10px">Your sign-in code</h1>
            <div style="font-size:34px;font-weight:700;letter-spacing:.18em;padding:18px 0">${code}</div>
            <p style="color:#6b7280;font-size:14px;line-height:1.5">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
          </div></body></html>`,
      }),
    });
    if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}
