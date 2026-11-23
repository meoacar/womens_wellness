import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpTls = this.configService.get<string>('SMTP_TLS', 'false');

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'localhost'),
      port: this.configService.get<number>('SMTP_PORT', 1025),
      secure: smtpTls === 'true',
      auth: smtpUser && smtpUser !== '__OPTIONAL__'
        ? {
            user: smtpUser,
            pass: this.configService.get<string>('SMTP_PASS'),
          }
        : undefined,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.configService.get<string>('API_BASE_URL')}/public/reset-password.html?token=${token}`;
    const appName = 'Women\'s Wellness Companion';

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM', 'no-reply@local.test'),
        to: email,
        subject: 'Şifre Sıfırlama Talebi',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .container {
                  background: linear-gradient(135deg, #FFB6D9 0%, #FF69B4 100%);
                  border-radius: 20px;
                  padding: 40px;
                  text-align: center;
                }
                .content {
                  background: white;
                  border-radius: 16px;
                  padding: 32px;
                  margin-top: 20px;
                }
                h1 {
                  color: #FF69B4;
                  font-size: 28px;
                  margin-bottom: 10px;
                }
                .emoji {
                  font-size: 48px;
                  margin-bottom: 20px;
                }
                p {
                  color: #525252;
                  font-size: 16px;
                  margin: 16px 0;
                }
                .button {
                  display: inline-block;
                  background: #FF69B4;
                  color: white;
                  text-decoration: none;
                  padding: 14px 32px;
                  border-radius: 16px;
                  font-weight: 700;
                  font-size: 16px;
                  margin: 24px 0;
                  box-shadow: 0 4px 8px rgba(255, 105, 180, 0.3);
                }
                .button:hover {
                  background: #E91E63;
                }
                .footer {
                  margin-top: 24px;
                  padding-top: 24px;
                  border-top: 1px solid #FFD4E7;
                  color: #9CA3AF;
                  font-size: 14px;
                }
                .warning {
                  background: #FFF0F5;
                  border-left: 4px solid #FF69B4;
                  padding: 16px;
                  margin: 20px 0;
                  border-radius: 8px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="emoji">💕</div>
                <h1>Şifre Sıfırlama</h1>
              </div>
              <div class="content">
                <p>Merhaba,</p>
                <p>Hesabınız için bir şifre sıfırlama talebi aldık. Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>

                <a href="${resetUrl}" class="button">Şifremi Sıfırla</a>

                <div class="warning">
                  <p style="margin: 0; font-size: 14px;">
                    ⏰ Bu bağlantı <strong>1 saat</strong> süreyle geçerlidir.
                  </p>
                </div>

                <p style="font-size: 14px;">Eğer şifre sıfırlama talebinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>

                <p style="font-size: 12px; color: #9CA3AF; margin-top: 24px;">
                  Buton çalışmıyorsa, aşağıdaki bağlantıyı tarayıcınıza kopyalayıp yapıştırın:<br>
                  <a href="${resetUrl}" style="color: #FF69B4; word-break: break-all;">${resetUrl}</a>
                </p>

                <div class="footer">
                  <p>${appName} ile sağlıklı günler! 💪</p>
                  <p style="font-size: 12px; margin-top: 8px;">Bu otomatik bir e-postadır, lütfen yanıtlamayın.</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
Merhaba,

Hesabınız için bir şifre sıfırlama talebi aldık.

Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın:
${resetUrl}

Bu bağlantı 1 saat süreyle geçerlidir.

Eğer şifre sıfırlama talebinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz.

${appName} ile sağlıklı günler!
        `,
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error);
      throw error;
    }
  }

  async sendAdminBroadcastEmail(to: string, subject: string, body: string): Promise<void> {
    const escapedBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM', 'no-reply@local.test'),
      to,
      subject,
      text: body,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
          <div style="background: linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%); padding: 20px 24px; border-radius: 16px 16px 0 0; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px;">Kadın Atlası</h2>
          </div>
          <div style="background: #ffffff; border: 1px solid #f3e8ff; border-top: none; border-radius: 0 0 16px 16px; padding: 24px; line-height: 1.65;">
            <p style="margin-top: 0;">${escapedBody}</p>
            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
            <p style="font-size: 12px; color: #9ca3af; margin-bottom: 0;">
              Bu e-posta Kadın Atlası yöneticileri tarafından bilgilendirme amacıyla gönderilmiştir.
            </p>
          </div>
        </div>
      `,
    });
  }

  async sendBackupEmail(to: string, filename: string, jsonContent: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP mail transporter is not configured');
    }

    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM', 'no-reply@local.test'),
      to,
      subject: 'Kadın Atlası — Kişisel Veri Yedeğiniz',
      text: 'Kadın Atlası hesabınıza ait taşınabilir veri yedeğiniz ektedir. Yeni bir cihaza geçtiğinizde Ayarlar > Yedek Dosyasından Geri Yükle adımından bu dosyayı seçebilirsiniz.',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
          <div style="background: linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%); padding: 20px 24px; border-radius: 16px 16px 0 0; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px;">Kadın Atlası — Veri Yedeği</h2>
          </div>
          <div style="background: #ffffff; border: 1px solid #f3e8ff; border-top: none; border-radius: 0 0 16px 16px; padding: 24px; line-height: 1.65;">
            <p style="margin-top: 0;">Merhaba,</p>
            <p>Kadın Atlası hesabınıza ait tüm döngü, sağlık ve wellness verilerinizin taşınabilir yedeği <strong>${filename}</strong> adıyla bu e-postaya eklenmiştir.</p>
            <p>Yeni bir telefona geçtiğinizde:</p>
            <ul>
              <li>Aynı e-posta veya Google hesabıyla giriş yaptığınızda verileriniz sunucudan otomatik yüklenir.</li>
              <li>İsterseniz ekteki bu JSON dosyasını indirip <strong>Ayarlar → Yedek Dosyasından Geri Yükle</strong> adımından da içe aktarabilirsiniz.</li>
            </ul>
          </div>
        </div>
      `,
      attachments: [
        {
          filename,
          content: jsonContent,
          contentType: 'application/json',
        },
      ],
    });
  }
}
