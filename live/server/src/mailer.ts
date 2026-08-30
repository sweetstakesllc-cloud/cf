export interface Mailer {
  sendOtp(email: string, code: string): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  async sendOtp(email: string, code: string): Promise<void> {
    console.log(`[mailer] OTP for ${email}: ${code}`);
  }
}
