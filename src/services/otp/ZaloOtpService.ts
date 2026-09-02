import { IOtpService } from './IOtpService';
import { ZaloTokenManager } from '../zalo/ZaloTokenManager';
import { logger } from '@/lib/logger';

export class ZaloOtpService implements IOtpService {
  private accessToken?: string;
  private forceRealSend: boolean;

  constructor(accessToken?: string, forceRealSend: boolean = false) {
    this.accessToken = accessToken;
    this.forceRealSend = forceRealSend;
  }

  async sendOtp(recipientId: string, otp: string, phone: string): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production' && !this.forceRealSend) {
      logger.info(`[DEV] Zalo OTP for ${phone}: ${otp}`);
      return true;
    }

    try {
      const token =
        this.accessToken ||
        (await ZaloTokenManager.getInstance().getAccessToken());
      const znsTemplateId = process.env.ZALO_ZNS_TEMPLATE_ID;

      // 1. Nếu có ZNS Template ID -> Ưu tiên gửi qua ZNS (Hỗ trợ SĐT trực tiếp)
      if (znsTemplateId) {
        const formattedPhone = phone.replace(/^0/, '84');
        const response = await fetch(
          'https://business.openapi.zalo.me/message/template',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              access_token: token,
            },
            body: JSON.stringify({
              phone: formattedPhone,
              template_id: znsTemplateId,
              template_data: { otp, phone },
              tracking_id: `otp_${Date.now()}`,
            }),
          }
        );

        const result = await response.json();
        if (result.error === 0) {
          logger.info(`[Zalo ZNS Success] Sent OTP to ${formattedPhone}`);
          return true;
        }
        logger.warn(
          '[Zalo ZNS Failed], trying OA Message fallback if user_id is provided:',
          result
        );
      }

      // 2. Gửi qua Zalo OA Message (Yêu cầu recipientId là Zalo User ID)
      const response = await fetch('https://openapi.zalo.me/v2.0/oa/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: token,
        },
        body: JSON.stringify({
          recipient: { user_id: recipientId },
          message: {
            text: `[VFC] Mã OTP của bạn (${phone}) là: ${otp}. Hết hạn sau 5 phút. Không chia sẻ mã này.`,
          },
        }),
      });

      const result = await response.json();
      if (result.error === 0) {
        logger.info(`[Zalo OA Message Success] Sent OTP to ${recipientId}`);
        return true;
      }

      logger.error('[Zalo OA Message Failed]:', result);
      return false;
    } catch (error) {
      logger.error('Zalo OTP Error:', error);
      return false;
    }
  }
}
