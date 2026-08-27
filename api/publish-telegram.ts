import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1294588369';

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ success: true, message: 'Slyde Telegram Publisher Endpoint' });
  }

  try {
    const { 
      slides = [], 
      title = 'Recipe Carousel', 
      caption, 
      botToken: clientToken, 
      chatId: clientChatId,
      messageThreadId 
    } = req.body || {};

    const botToken = (clientToken && clientToken.trim()) || process.env.TELEGRAM_BOT_TOKEN;
    const rawChat = (clientChatId && clientChatId.trim()) || '';
    const chatId = (rawChat && !rawChat.toLowerCase().includes('claaaaaark')) ? rawChat : (DEFAULT_CHAT_ID || '1294588369');

    if (!botToken) {
      return res.status(400).json({ success: false, message: 'TELEGRAM_BOT_TOKEN is not configured on server' });
    }

    if (!slides || slides.length === 0) {
      return res.status(400).json({ success: false, message: 'No slide images provided' });
    }

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const parts: Buffer[] = [];

    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`));
    if (messageThreadId) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="message_thread_id"\r\n\r\n${messageThreadId}\r\n`));
    }

    const formattedCaption = caption || `🍳 <b>${escapeHtml(title)}</b>`;

    const mediaList = slides.map((_: any, idx: number) => {
      const attachName = `slide_${idx + 1}`;
      return {
        type: 'photo',
        media: `attach://${attachName}`,
        caption: idx === 0 ? formattedCaption : undefined,
        parse_mode: 'HTML'
      };
    });

    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"\r\n\r\n${JSON.stringify(mediaList)}\r\n`));

    for (let i = 0; i < slides.length; i++) {
      let rawBase64 = slides[i];
      if (typeof rawBase64 === 'string' && rawBase64.includes('base64,')) {
        rawBase64 = rawBase64.split('base64,')[1];
      }
      const buffer = Buffer.from(rawBase64, 'base64');
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="slide_${i + 1}"; filename="slide-${i + 1}.png"\r\nContent-Type: image/png\r\n\r\n`));
      parts.push(buffer);
      parts.push(Buffer.from(`\r\n`));
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length)
      },
      body
    });

    const telegramData = await telegramRes.json();

    if (!telegramData.ok) {
      let msg = telegramData.description || 'Telegram API rejected the media album.';
      if (msg.includes("bot can't send messages to the bot") || msg.includes('chat not found')) {
        msg = `Cannot send to "${chatId}" (bots cannot message themselves). In Settings, enter your personal numeric User ID (message /start to @Claaaaaarkbot to see it) or your Channel username (e.g. @mychannel).`;
      }
      return res.status(200).json({
        success: false,
        message: msg
      });
    }

    return res.status(200).json({
      success: true,
      message: `3-Slide carousel published to ${chatId}! 🚀`
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: `Server publisher error: ${error.message}`
    });
  }
}
