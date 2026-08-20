import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const botToken = (req.query.token as string) || process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = (req.query.url as string) || (req.headers.host ? `https://${req.headers.host}/api/telegram-webhook` : '');
  const action = (req.query.action as string) || 'set';

  if (!botToken) {
    return res.status(400).json({
      success: false,
      message: 'Missing bot token. Provide ?token=YOUR_BOT_TOKEN or set TELEGRAM_BOT_TOKEN env variable.'
    });
  }

  try {
    if (action === 'delete') {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
      const data = await resp.json();
      return res.status(200).json({ success: true, message: 'Webhook deleted', telegramResponse: data });
    }

    if (action === 'info') {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const data = await resp.json();
      return res.status(200).json({ success: true, webhookInfo: data });
    }

    const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const data = await setRes.json();

    return res.status(200).json({
      success: data.ok,
      message: data.description || 'Webhook configuration updated',
      webhookUrl,
      telegramResponse: data
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
