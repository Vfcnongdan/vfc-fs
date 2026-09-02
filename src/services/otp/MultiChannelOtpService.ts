import { IOtpService } from './IOtpService';
import { logger } from '@/lib/logger';

export interface ChannelConfig {
  name: string;
  service: IOtpService;
  target: string;
}

export class MultiChannelOtpService implements IOtpService {
  private channels: ChannelConfig[];

  constructor(channels: ChannelConfig[]) {
    this.channels = channels;
  }

  async sendOtp(to: string, otp: string, phone: string): Promise<boolean> {
    const results = await Promise.allSettled(
      this.channels.map(async ({ name, service, target }) => {
        logger.info(`[MultiChannel] Sending OTP via ${name} to target: ${target}`);
        const success = await service.sendOtp(target, otp, phone);
        return { name, success };
      })
    );

    let successCount = 0;
    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value.success) {
        successCount++;
        logger.info(`[MultiChannel] ${res.value.name}: SUCCESS`);
      } else {
        const reason = res.status === 'rejected' ? res.reason : 'Returned false';
        logger.warn(`[MultiChannel] Channel failed:`, reason);
      }
    });

    // Trả về true nếu có ít nhất 1 kênh gửi thành công
    return successCount > 0;
  }
}
