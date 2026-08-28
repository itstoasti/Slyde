import { RecipeData, TelegramConfig, ThemeConfig, AspectRatio } from '../types';
import { extractRecipeFromUrl } from './recipeExtractor';
import { sendSlideshowToTelegram } from './telegram';
import { captureSlideAsBlob } from './exporter';
import { generateBothSocialCaptions } from './geminiCaption';

export interface TelegramListenerCallbacks {
  onRecipeReceived: (recipe: RecipeData, senderName: string, requestedAspectRatio?: AspectRatio) => void;
  onStatusUpdate: (statusText: string) => void;
  slide1Ref: React.RefObject<HTMLDivElement>;
  slide2Ref: React.RefObject<HTMLDivElement>;
  slide3Ref: React.RefObject<HTMLDivElement>;
}

let isListening = false;
let lastUpdateId = 0;

/**
 * Start Long-Polling for Incoming Telegram Messages
 */
export async function startTelegramListener(
  config: TelegramConfig,
  _theme: ThemeConfig,
  brandDefaults: { brandName: string; socialHandle: string; ctaUrl: string },
  callbacks: TelegramListenerCallbacks
) {
  if (!config.botToken) return;
  isListening = true;
  callbacks.onStatusUpdate('🟢 Telegram Bot Live: Send any recipe link in Telegram to auto-generate 3 slides + caption!');

  while (isListening) {
    try {
      const url = `https://api.telegram.org/bot${config.botToken.trim()}/getUpdates?offset=${lastUpdateId + 1}&timeout=20`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;

          const message = update.message || update.channel_post;
          if (message && message.text) {
            const text: string = message.text.trim();
            const chatId = String(message.chat.id);
            const messageThreadId = message.message_thread_id;
            const senderName = message.from?.first_name || message.from?.username || 'Chef';

            // Check if message contains a URL
            const urlMatch = text.match(/https?:\/\/[^\s]+/i);
            if (urlMatch) {
              const recipeUrl = urlMatch[0];
              const lowerText = text.toLowerCase();

              let requestedAspectRatio: AspectRatio | undefined;
              if (lowerText.includes('1:1') || lowerText.includes('square') || lowerText.startsWith('/sq')) {
                requestedAspectRatio = '1:1';
              } else if (lowerText.includes('4:5') || lowerText.includes('portrait') || lowerText.includes('feed')) {
                requestedAspectRatio = '4:5';
              } else if (lowerText.includes('9:16') || lowerText.includes('vertical') || lowerText.includes('story') || lowerText.includes('reel') || lowerText.includes('tiktok')) {
                requestedAspectRatio = '9:16';
              }

              const ratioTag = requestedAspectRatio ? ` [${requestedAspectRatio}]` : '';
              callbacks.onStatusUpdate(`📥 Received recipe link${ratioTag} from @${message.from?.username || senderName}: ${recipeUrl}`);

              // 1. Send immediate progress acknowledgment in Telegram
              await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
                  text: `👨‍🍳 <b>Extracting recipe & rendering 3 social slides${ratioTag}...</b>`,
                  parse_mode: 'HTML'
                })
              });

              // 2. Extract recipe data
              const recipe = await extractRecipeFromUrl(recipeUrl, brandDefaults);
              callbacks.onRecipeReceived(recipe, senderName, requestedAspectRatio);

              // 3. Wait for React DOM to render the new recipe in slide DOM nodes
              await new Promise(r => setTimeout(r, 1400));

              // 4. Capture all 3 slides as high-res PNG blobs
              const elements = [
                callbacks.slide1Ref.current,
                callbacks.slide2Ref.current,
                callbacks.slide3Ref.current
              ].filter(Boolean) as HTMLElement[];

              if (elements.length >= 3) {
                callbacks.onStatusUpdate('📸 Capturing 3 high-res carousel slides...');
                const blobs: Blob[] = [];
                for (const el of elements) {
                  blobs.push(await captureSlideAsBlob(el, 2));
                }

                // 5. Send 3-slide photo album to Telegram
                const targetChatConfig = {
                  ...config,
                  chatId: chatId,
                  messageThreadId: messageThreadId
                };

                const sendResult = await sendSlideshowToTelegram(
                  targetChatConfig,
                  blobs,
                  recipe,
                  undefined,
                  (msg: string) => callbacks.onStatusUpdate(msg)
                );

                if (!sendResult.success) {
                  console.warn('sendSlideshowToTelegram failed:', sendResult.message);
                }

                // 6. Generate viral social media caption with Gemini AI
                callbacks.onStatusUpdate('✨ Generating viral social caption with Gemini...');
                const captions = await generateBothSocialCaptions(recipe);
                const fullCaption = captions.long;

                // 7. Send full caption as formatted follow-up message in Telegram
                await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
                    text: `📝 *Viral Social Caption (Ready to Copy & Paste):*\n\n${fullCaption}`
                  })
                });

                callbacks.onStatusUpdate(`🚀 Sent 3 slides + full social caption to @${senderName}!`);
              }
            } else if (text.startsWith('/start') || text.startsWith('/help')) {
              await fetch(`https://api.telegram.org/bot${config.botToken.trim()}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
                  text: `👋 <b>Welcome to Slyde Bot!</b>\n\nSend me <b>any recipe URL</b> (from AllRecipes, NYT Cooking, blogs, etc.) and I will automatically reply with:\n\n1️⃣ <b>Full 3-Slide Carousel Album</b> (Hook, Recipe Card, CTA)\n2️⃣ <b>Viral Social Caption</b> with ingredients, steps, and hashtags!\n\n<i>Powered by Slyde Carousel Studio.</i>`,
                  parse_mode: 'HTML'
                })
              });
            }
          }
        }
      }
    } catch (err: any) {
      if (!isListening) break;
      console.warn('Telegram polling retry', err.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

/**
 * Stop Long-Polling Listener
 */
export function stopTelegramListener() {
  isListening = false;
}
