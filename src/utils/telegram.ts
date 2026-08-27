import { RecipeData, TelegramConfig } from '../types';

export interface TelegramTestResult {
  success: boolean;
  message: string;
  botUsername?: string;
}

export interface TelegramSendResult {
  success: boolean;
  message: string;
}

/**
 * Verify Bot Token and Chat ID
 */
export async function testTelegramBot(token: string, chatId?: string): Promise<TelegramTestResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, message: 'Please provide a Telegram Bot Token.' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = await res.json();

    if (!data.ok) {
      return {
        success: false,
        message: data.description || 'Invalid Telegram Bot Token.'
      };
    }

    const botName = data.result?.username || data.result?.first_name || 'Bot';

    // If chat ID provided, send a quick test ping
    if (chatId && chatId.trim()) {
      const cleanChatId = chatId.trim();
      const sendRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: `✨ *Slyde Connected!* 🚀\nYour Telegram bot *@${botName}* is ready to receive recipe carousel slide decks.`,
          parse_mode: 'Markdown'
        })
      });
      const sendData = await sendRes.json();
      if (!sendData.ok) {
        return {
          success: false,
          message: `Bot @${botName} connected, but failed to send to Chat ID: ${sendData.description}. Make sure you have started a chat with @${botName} first!`
        };
      }
      return {
        success: true,
        message: `Connected to @${botName}! Test message sent successfully to ${cleanChatId}.`,
        botUsername: botName
      };
    }

    return {
      success: true,
      message: `Token valid! Connected to @${botName}. Add a Chat ID to test sending.`,
      botUsername: botName
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Network error connecting to Telegram: ${error.message || 'Check your internet connection'}`
    };
  }
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Clean minimal title for Telegram
 */
function createTelegramCaption(recipe: RecipeData): string {
  return `🍳 <b>${escapeHtml(recipe.title)}</b>`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Send 3 Carousel Slide Images to Telegram as an Album
 */
export async function sendSlideshowToTelegram(
  config: TelegramConfig,
  slideBlobs: Blob[],
  recipe: RecipeData,
  onProgress?: (status: string) => void
): Promise<TelegramSendResult> {
  const token = (config.botToken && config.botToken.trim()) || '';
  const chatId = (config.chatId && config.chatId.trim()) || '@Claaaaaarkbot';

  if (slideBlobs.length === 0) {
    return {
      success: false,
      message: 'No slide images to send.'
    };
  }

  try {
    onProgress?.('Preparing high-res slides for Telegram...');
    const base64Slides = await Promise.all(slideBlobs.map(blobToBase64));

    onProgress?.('Publishing 3-slide carousel to Telegram...');

    // 1. Try server-side publisher endpoint first (avoids browser ad blockers & CORS)
    try {
      const serverRes = await fetch('/api/publish-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: base64Slides,
          title: recipe.title,
          caption: config.includeCaption ? createTelegramCaption(recipe) : '',
          botToken: token,
          chatId: chatId,
          messageThreadId: config.messageThreadId
        })
      });

      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData.success) {
          return {
            success: true,
            message: serverData.message || `3-Slide carousel published to ${chatId}! 🚀`
          };
        } else if (serverData.message) {
          return {
            success: false,
            message: serverData.message
          };
        }
      }
    } catch (serverErr) {
      console.warn('Server publish endpoint unavailable, falling back to direct client upload', serverErr);
    }

    // 2. Client-side direct fallback
    const formData = new FormData();
    formData.append('chat_id', chatId);
    if (config.messageThreadId) {
      formData.append('message_thread_id', String(config.messageThreadId));
    }

    const caption = config.includeCaption ? createTelegramCaption(recipe) : '';

    const media = slideBlobs.map((blob, index) => {
      const attachName = `slide_${index + 1}`;
      formData.append(attachName, blob, `slide-${index + 1}.png`);
      return {
        type: 'photo',
        media: `attach://${attachName}`,
        caption: index === 0 && caption ? caption : undefined,
        parse_mode: 'HTML'
      };
    });

    formData.append('media', JSON.stringify(media));

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!data.ok) {
      return {
        success: false,
        message: data.description || 'Failed to send slides to Telegram.'
      };
    }

    return {
      success: true,
      message: `3-Slide carousel published to ${chatId}! 🚀`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Telegram upload failed: ${error.message || 'Network error'}`
    };
  }
}
