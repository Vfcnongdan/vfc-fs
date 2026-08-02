import { IOtpService } from './IOtpService';
import { TelegramOtpService } from './TelegramOtpService';
import { ZaloOtpService } from './ZaloOtpService';
import { MultiChannelOtpService } from './MultiChannelOtpService';

export class OtpServiceFactory {
  static create(
    provider: 'telegram' | 'zalo' | 'all' | string,
    options?: { phone: string; chatId?: string }
  ): IOtpService {
    const telegramService = new TelegramOtpService(
      process.env.TELEGRAM_BOT_TOKEN || ''
    );
    const zaloService = new ZaloOtpService();

    if (provider === 'telegram') {
      return telegramService;
    }

    if (provider === 'zalo') {
      return zaloService;
    }

    // Mặc định hoặc khi provider === 'all': Gửi ĐỒNG THỜI qua cả 2 kênh Zalo & Telegram
    const telegramTarget =
      process.env.TELEGRAM_CHAT_ID || options?.chatId || options?.phone || '';
    const zaloTarget = options?.chatId || options?.phone || '';

    return new MultiChannelOtpService([
      { name: 'Zalo', service: zaloService, target: zaloTarget },
      { name: 'Telegram', service: telegramService, target: telegramTarget },
    ]);
  }
}
