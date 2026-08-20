import { RecipeData, AIConfig } from '../types';

export interface AITestResult {
  success: boolean;
  message: string;
}

export interface DualSocialCaptions {
  long: string;
  short: string;
  hook: string;
  hashtags: string[];
}

export const OPENROUTER_MODELS = [
  { id: 'openrouter/auto', name: '⚡ OpenRouter Auto (Smart Router)' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (Fast & Cheap)' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku (High Quality)' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Popular & Fast)' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: '🎁 Llama 3.3 70B (Free Tier)' },
  { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: '🎁 Qwen 2.5 32B (Free Tier)' },
  { id: 'mistralai/mistral-small-24b-instruct-2501', name: 'Mistral Small 24B' },
  { id: 'custom', name: '✏️ Custom Model ID...' }
];

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Ultra Fast)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)' }
];

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gemini',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openRouterApiKey: '',
  openRouterModel: 'openrouter/auto'
};

export function getStoredAIConfig(): AIConfig {
  try {
    const saved = localStorage.getItem('slyde_ai_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_AI_CONFIG, ...parsed };
    }
  } catch (e) {}

  const oldGeminiKey = localStorage.getItem('slyde_gemini_api_key') || '';
  return {
    ...DEFAULT_AI_CONFIG,
    geminiApiKey: oldGeminiKey
  };
}

export function saveStoredAIConfig(config: AIConfig): void {
  try {
    localStorage.setItem('slyde_ai_config', JSON.stringify(config));
    if (config.geminiApiKey) {
      localStorage.setItem('slyde_gemini_api_key', config.geminiApiKey);
    }
    if (config.openRouterApiKey) {
      localStorage.setItem('slyde_openrouter_api_key', config.openRouterApiKey);
    }
  } catch (e) {}
}

function toTitleCase(str: string): string {
  const minorWords = new Set(['and', 'with', 'in', 'on', 'at', 'to', 'for', 'a', 'an', 'the', 'of', 'or', '&']);
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (!word) return '';
      if (index > 0 && minorWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function cleanCalories(rawCal: any): string {
  if (!rawCal || rawCal === 'N/A') return 'cal 320';
  const str = String(rawCal).trim();
  const numMatch = str.match(/(\d+)/);
  return numMatch ? `cal ${numMatch[1]}` : 'cal 320';
}

function cleanTeaser(raw: string): string {
  let str = (raw || '').trim();

  // 1. Strip reasoning tags (<think>...</think>)
  str = str.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip code fences & quotes
  str = str.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  str = str.replace(/^["']|["']$/g, '').trim();

  // 3. Detect and discard raw reasoning dumps or prompt echoes
  const isMetaDump = 
    /^(?:we need to|i need to|let's count|so something like|teaser:|note:|json|here is|here's|respond with|the user)/i.test(str) ||
    str.toLowerCase().includes('count words') ||
    str.toLowerCase().includes('raw json') ||
    str.toLowerCase().includes('punchy viral sentence') ||
    str.toLowerCase().includes('no ingredient counts') ||
    str.length > 220;

  if (isMetaDump) {
    return 'Better than takeout and ready in minutes.';
  }

  // 4. Strip trailing stats like '10 ingredients, 5 steps...' if present
  str = str.replace(/,?\s*\d+\s*ingredients.*$/i, '').trim();
  // Strip emojis without removing words
  str = str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '').trim();
  // Remove dangling punctuation at end
  str = str.replace(/[,\s—\-_;:]+$/, '').trim();

  if (str && !str.endsWith('.') && !str.endsWith('!')) {
    str += '.';
  }

  return str || 'Better than takeout and ready in minutes.';
}

export function generateRelevantHashtags(recipe: RecipeData, aiTags?: string[]): string {
  const brandTag = (recipe.brandName || 'SnapRecipes').replace(/\s+/g, '');
  const tags = new Set<string>();
  tags.add(`#${brandTag}`);

  if (Array.isArray(aiTags) && aiTags.length > 0) {
    aiTags.forEach(t => {
      const clean = t
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/^#+/, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .trim();
      if (clean && clean.length > 1) {
        tags.add(`#${clean}`);
      }
    });
    return Array.from(tags).slice(0, 7).join(' ');
  }

  // Stop words for ingredients (measurement units, preparation words)
  const stopWords = new Set([
    'fresh', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
    'package', 'packages', 'pkg', 'pkgs', 'container', 'containers', 'instant', 'prepared',
    'frozen', 'thawed', 'large', 'small', 'medium', 'clove', 'cloves', 'ounce', 'ounces', 'oz',
    'pound', 'pounds', 'lb', 'lbs', 'gram', 'grams', 'slice', 'slices', 'can', 'cans', 'diced',
    'chopped', 'minced', 'melted', 'crushed', 'warm', 'cold', 'hot', 'divided', 'optional',
    'taste', 'pinch', 'dash', 'all', 'purpose', 'extra', 'virgin', 'dry', 'white', 'black', 'water',
    'square', 'squares', 'and', 'with', 'the', 'for', 'from', 'style'
  ]);

  const cleanTitleWords = recipe.title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

  // 1. Full Dish Tag (e.g. #EclairCake, #LemonLush)
  const fullDish = cleanTitleWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  if (fullDish.length < 25 && fullDish.length > 2) {
    tags.add(`#${fullDish}`);
  }

  // 2. Individual key words from title (e.g. #Eclair, #Cake)
  cleanTitleWords.forEach(w => {
    tags.add(`#${w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()}`);
  });

  // 3. Prominent food ingredients (ignoring measurement units)
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    recipe.ingredients.slice(0, 4).forEach(ing => {
      const words = ing.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));

      if (words.length > 0) {
        const mainWord = words[0];
        tags.add(`#${mainWord.charAt(0).toUpperCase() + mainWord.slice(1).toLowerCase()}`);
      }
    });
  }

  // 4. Meal & Category Tag
  const titleLower = recipe.title.toLowerCase();
  if (titleLower.includes('salad')) tags.add('#SaladRecipe');
  if (titleLower.includes('nacho') || titleLower.includes('dip') || titleLower.includes('bite') || titleLower.includes('wing')) tags.add('#Appetizers');
  if (titleLower.includes('pasta') || titleLower.includes('noodle')) tags.add('#PastaNight');
  if (titleLower.includes('soup') || titleLower.includes('chili') || titleLower.includes('stew')) tags.add('#CozyFood');
  if (titleLower.includes('cake') || titleLower.includes('cookie') || titleLower.includes('pudding') || titleLower.includes('dessert') || titleLower.includes('brownie') || titleLower.includes('eclair') || titleLower.includes('éclair')) tags.add('#DessertRecipes');
  if (titleLower.includes('steak') || titleLower.includes('chicken') || titleLower.includes('salmon') || titleLower.includes('beef') || titleLower.includes('pork')) tags.add('#DinnerIdeas');

  tags.add('#EasyRecipes');
  return Array.from(tags).slice(0, 7).join(' ');
}

/**
 * Verify Gemini API Key
 */
export async function testGeminiApiKey(apiKey: string, model: string = 'gemini-2.5-flash'): Promise<AITestResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: 'Please enter a Gemini API Key.' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Respond with the single word "READY"' }]
        }]
      })
    });

    const data = await res.json();
    if (data.error) {
      return {
        success: false,
        message: data.error.message || 'Invalid Gemini API Key.'
      };
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (reply) {
      return {
        success: true,
        message: '✨ Google Gemini API Key verified and active!'
      };
    }

    return {
      success: false,
      message: 'Gemini API responded with no content.'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Network error verifying Gemini key: ${error.message}`
    };
  }
}

/**
 * Verify OpenRouter API Key
 */
export async function testOpenRouterApiKey(apiKey: string, model: string = 'openrouter/auto'): Promise<AITestResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: 'Please enter an OpenRouter API Key.' };
  }

  const modelToUse = model || 'openrouter/auto';

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://slyde-bay.vercel.app';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`,
        'HTTP-Referer': origin,
        'X-Title': 'Slyde Carousel Studio'
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [{ role: 'user', content: 'Say READY' }],
        max_tokens: 50
      })
    });

    const data = await res.json();
    if (data.error) {
      return {
        success: false,
        message: data.error.message || 'Invalid OpenRouter API Key.'
      };
    }

    const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.choices?.[0]?.message?.reasoning;
    if (reply || data.id || (Array.isArray(data.choices) && data.choices.length > 0)) {
      return {
        success: true,
        message: `✨ OpenRouter verified and connected with ${modelToUse}!`
      };
    }

    return {
      success: false,
      message: 'OpenRouter returned an empty response. Check if model ID is available.'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Network error verifying OpenRouter key: ${error.message}`
    };
  }
}

/**
 * Format Full Social Media Recipe Caption
 */
export function formatCompleteSocialCaption(recipe: RecipeData, viralHook?: string, customHashtags?: string[]): string {
  const brandName = recipe.brandName || 'SnapRecipes';
  const rawUrl = recipe.ctaUrl || 'snaprecipes.xyz';
  const ctaUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  const teaser = cleanTeaser(viralHook || recipe.shortHook || `Better than takeout and ready in ${recipe.cookTime || recipe.prepTime}`);
  const hook = `${teaser} ${recipe.ingredients.length} ingredients, ${recipe.method.length} steps. 🍽️`;

  const ingredientsList = recipe.ingredients
    .map(ing => `- ${ing.name}${ing.amount ? ' — ' + ing.amount : ''}`)
    .join('\n');

  const stepsList = recipe.method
    .map((step, idx) => `${idx + 1}. ${step}`)
    .join('\n');

  const tagList = generateRelevantHashtags(recipe, customHashtags);

  return `${recipe.title} — ${hook}

What you need:
${ingredientsList}

How to:
${stepsList}

Prep ${recipe.prepTime} · Cook ${recipe.cookTime} · Makes ${recipe.servings} · ${cleanCalories(recipe.calories)}

Save this recipe on ${brandName} — skip the life story, get straight to cooking. Get the app: ${ctaUrl}

${tagList}`.trim();
}

/**
 * Format Short Social Media Caption
 */
export function formatShortSocialCaption(recipe: RecipeData, viralTeaser?: string, customHashtags?: string[]): string {
  const brandName = recipe.brandName || 'SnapRecipes';
  const rawUrl = recipe.ctaUrl || 'snaprecipes.xyz';
  const ctaUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  const formattedTitle = toTitleCase(recipe.title);
  const teaser = cleanTeaser(viralTeaser || recipe.shortHook || 'Better than takeout and ready in minutes.');

  const totalTime = recipe.cookTime || recipe.prepTime || '30 min';
  const cleanTime = totalTime.replace(/\s*min(?:utes?)?/i, ' min').replace(/m$/, ' min');
  const statsLine = `${recipe.ingredients.length} ingredients, ${recipe.method.length} steps, ${cleanTime}. 🍽️`;

  const tagList = generateRelevantHashtags(recipe, customHashtags);

  return `${formattedTitle} — ${teaser} ${statsLine}

Save this recipe on ${brandName} — skip the life story, get straight to cooking. Get the app: ${ctaUrl}

${tagList}`.trim();
}

export function generateLocalSocialCaption(recipe: RecipeData, mode: 'long' | 'short' = 'long'): string {
  return mode === 'short' 
    ? formatShortSocialCaption(recipe) 
    : formatCompleteSocialCaption(recipe);
}

/**
 * Generate Captions via OpenRouter
 */
async function generateWithOpenRouter(
  recipe: RecipeData,
  apiKey: string,
  model: string = 'openrouter/auto'
): Promise<{ hook?: string; hashtags: string[] }> {
  try {
    const ingList = recipe.ingredients.slice(0, 6).map(i => i.name).join(', ');
    const prompt = `You are a social media chef writing a viral 1-sentence teaser (8-14 words) for this recipe: "${recipe.title}".
Ingredients: ${ingList}
Time: ${recipe.cookTime || recipe.prepTime || '30m'}

You MUST output ONLY a valid JSON object with {"teaser": "...", "hashtags": [...]}.
Do NOT output any chain-of-thought, reasoning, words counting, or explanations.
Example output:
{"teaser": "Layers of creamy vanilla pudding and chocolate make this no-bake dessert an instant crowd favorite.", "hashtags": ["#EclairCake", "#NoBakeDessert", "#DessertRecipes"]}`;

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://slyde-bay.vercel.app';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': origin,
        'X-Title': 'Slyde Carousel Studio'
      },
      body: JSON.stringify({
        model: model || 'openrouter/auto',
        messages: [
          { role: 'system', content: 'You are an AI chef that outputs ONLY raw JSON objects with {"teaser": "...", "hashtags": [...]}. Never output thinking or preambles.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 250
      })
    });

    if (res.ok) {
      const data = await res.json();
      let rawText = data.choices?.[0]?.message?.content?.trim() || data.choices?.[0]?.text?.trim() || '';
      // Strip <think>...</think>
      rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      // Strip markdown code fences
      rawText = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const teaser = typeof parsed.teaser === 'string' ? cleanTeaser(parsed.teaser) : '';
          const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
          if (teaser) {
            return {
              hook: teaser,
              hashtags
            };
          }
        } catch (e) {}
      }

      const clean = cleanTeaser(rawText);
      if (clean) {
        return { hook: clean, hashtags: [] };
      }
    }
  } catch (e) {
    console.warn('OpenRouter hook generation error', e);
  }
  return { hashtags: [] };
}

/**
 * Generate Captions via Google Gemini
 */
async function generateWithGemini(
  recipe: RecipeData,
  apiKey: string,
  model: string = 'gemini-2.5-flash'
): Promise<{ hook?: string; hashtags: string[] }> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    const ingList = recipe.ingredients.slice(0, 6).map(i => i.name).join(', ');
    const prompt = `Generate social media caption content for this recipe:
Recipe Title: "${recipe.title}"
Key Ingredients: ${ingList}
Time: ${recipe.cookTime || recipe.prepTime || '30m'}

Respond in JSON format:
{
  "teaser": "1 punchy viral sentence (8-14 words) about taste, speed, or texture.",
  "hashtags": ["#SnapRecipes", "#SpecificDishName", "#KeyIngredient", "#MealCategory", "#CookingStyle", "#EasyRecipes"]
}

Guidelines:
- "teaser" MUST be a complete grammatical sentence. Do not mention ingredient counts, step numbers, or emojis.
- "hashtags" MUST be 5-6 highly relevant, specific hashtags tailored to this exact recipe.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 350,
          responseMimeType: 'application/json'
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          const teaser = typeof parsed.teaser === 'string' ? cleanTeaser(parsed.teaser) : '';
          return {
            hook: teaser,
            hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : []
          };
        } catch (e) {
          const clean = cleanTeaser(rawText);
          return { hook: clean, hashtags: [] };
        }
      }
    }
  } catch (error) {
    console.warn('Gemini hook generation error', error);
  }
  return { hashtags: [] };
}

/**
 * Generate Both Long and Short Captions with Active AI Provider (Gemini or OpenRouter)
 */
export async function generateBothSocialCaptions(
  recipe: RecipeData,
  apiKeyOrConfig?: string | Partial<AIConfig>
): Promise<DualSocialCaptions> {
  const customConfig: Partial<AIConfig> = typeof apiKeyOrConfig === 'string'
    ? { geminiApiKey: apiKeyOrConfig }
    : (apiKeyOrConfig || {});
  const config = { ...getStoredAIConfig(), ...customConfig };

  let result: { hook?: string; hashtags: string[] } = { hashtags: [] };

  if (config.provider === 'openrouter' && config.openRouterApiKey) {
    result = await generateWithOpenRouter(recipe, config.openRouterApiKey, config.openRouterModel);
  } else if (config.geminiApiKey) {
    result = await generateWithGemini(recipe, config.geminiApiKey, config.geminiModel);
  }

  return {
    long: formatCompleteSocialCaption(recipe, result.hook, result.hashtags.length > 0 ? result.hashtags : undefined),
    short: formatShortSocialCaption(recipe, result.hook, result.hashtags.length > 0 ? result.hashtags : undefined),
    hook: result.hook || recipe.shortHook,
    hashtags: result.hashtags
  };
}

export async function generateSocialCaptionWithGemini(
  recipe: RecipeData,
  apiKey?: string,
  mode: 'long' | 'short' = 'long'
): Promise<string> {
  const both = await generateBothSocialCaptions(recipe, apiKey ? { geminiApiKey: apiKey } : undefined);
  return mode === 'short' ? both.short : both.long;
}
