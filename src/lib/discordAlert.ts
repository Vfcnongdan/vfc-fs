/**
 * Discord Webhook Alerting Service for Production Observability (0đ - Realtime)
 * - Tự động gửi Embed cảnh báo sự cố nghiêm trọng / Exception trên Production về Discord Channel
 * - Có cơ chế Rate-limit cooldown chống spam tin nhắn khi lỗi lặp liên tục
 */

let lastAlertTimestamp = 0;
const ALERT_COOLDOWN_MS = 15000; // Tối đa 1 cảnh báo mỗi 15 giây

export async function sendDiscordAlert(
  serviceName: string,
  errorTitle: string,
  errorDetails?: any
) {
  // Chỉ kích hoạt trên môi trường Production
  if (process.env.NODE_ENV !== "production") return;

  const webhookUrl =
    process.env.DISCORD_WEBHOOK_URL ||
    process.env.DISCORD_ALERT_WEBHOOK_URL;

  if (!webhookUrl) return;

  const now = Date.now();
  if (now - lastAlertTimestamp < ALERT_COOLDOWN_MS) {
    return; // Đang trong thời gian cooldown
  }
  lastAlertTimestamp = now;

  const timeStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  let detailStr = "";
  if (errorDetails) {
    if (typeof errorDetails === "string") {
      detailStr = errorDetails.slice(0, 1000);
    } else if (errorDetails instanceof Error) {
      detailStr = `${errorDetails.message}\n${errorDetails.stack?.split("\n").slice(0, 4).join("\n") || ""}`.slice(0, 1000);
    } else {
      try {
        detailStr = JSON.stringify(errorDetails, null, 2).slice(0, 1000);
      } catch {
        detailStr = String(errorDetails).slice(0, 1000);
      }
    }
  }

  // Cấu trúc Discord Embed đẹp mắt với màu đỏ cảnh báo (Red 0xEF4444)
  const payload = {
    username: "VFC Production Alert",
    avatar_url: "https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/nodejs/nodejs.png",
    embeds: [
      {
        title: `🚨 [PROD ALERT] ${errorTitle.slice(0, 200)}`,
        color: 0xef4444, // Màu đỏ cảnh báo
        fields: [
          {
            name: "🖥️ Service",
            value: `\`${serviceName}\``,
            inline: true,
          },
          {
            name: "⏰ Thời gian",
            value: timeStr,
            inline: true,
          },
          ...(detailStr
            ? [
                {
                  name: "📋 Chi tiết lỗi",
                  value: `\`\`\`ts\n${detailStr}\n\`\`\``,
                  inline: false,
                },
              ]
            : []),
        ],
        footer: {
          text: "VFC Production Observability • 100k Users Ready",
        },
      },
    ],
  };

  try {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null); // Chạy ngầm, không block request
  } catch {
    // Bỏ qua nếu lỗi mạng gửi webhook
  }
}
