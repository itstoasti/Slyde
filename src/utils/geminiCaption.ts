import { RecipeData } from '../types';

export interface GeminiTestResult {
  success: boolean;
  message: string;
}

export interface DualSocialCaptions {
  long: string;
  short: string;
  hook: string;
  hashtags: string[];
}

function toTitleCase(str: string): string {
  const minorWords = new Set(['and', 'with', 'in', 'on', 'at', 'to', 'for', 'a', 'an', 'the', 'of', 'or', '&']);
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (!word) return '';
      if (index > 0 && minorWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function cleanTeaser(raw: string): string {
  let str = (raw || '').trim();
  // Strip trailing stats like '10 ingredients, 5 steps...' if present
  str = str.replace(/,?\s*\d+\s*ingredients.*$/i, '').trim();
  // Strip emojis and variation selectors without removing words
  str = str.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '').trim();
  // Remove dangling commas, colons, or hyphens at the end
  str = str.replace(/[,\s—\-_;:]+$/, '').trim();
  if (str && !str.endsWith('.') && !str.endsWith('!')) {
    str += '.';
  }
  return str || 'Better than takeout and ready in minutes.';
}

/**
 * Build Hyper-Relevant Recipe Specific Hashtags (AI + Smart Semantic Fallback)
 */
export function generateRelevantHashtags(recipe: RecipeData, aiTags?: string[]): string {
  const brandTag = (recipe.brandName || 'SnapRecipes').replace(/\s+/g, '');
  const tags = new Set<string>();
  tags.add(`#${brandTag}`);

  if (Array.isArray(aiTags) && aiTags.length > 0) {
    aiTags.forEach(t => {
      const clean = t.replace(/^#+/, '').replace(/[^a-zA-Z0-9]/g, '').trim();
      if (clean && clean.length > 1) {
        tags.add(`#${clean}`);
      }
    });
    return Array.from(tags).slice(0, 7).join(' ');
  }

  // Smart local semantic tag generation
  const cleanTitleWords = recipe.title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['and', 'with', 'the', 'for', 'from', 'style'].includes(w.toLowerCase()));

  // 1. Full Dish Tag without spaces (e.g. #CrabRangoonNachos, #KaleSalad)
  const fullDish = cleanTitleWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  if (fullDish.length < 25) {
    tags.add(`#${fullDish}`);
  }

  // 2. Individual key words from title (e.g. #Crab, #Rangoon, #Nachos)
  cleanTitleWords.forEach(w => {
    tags.add(`#${w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()}`);
  });

  // 3. Prominent ingredients from ingredient list
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    recipe.ingredients.slice(0, 3).forEach(ing => {
      const mainWord = ing.name.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).find(w => w.length > 3 && !['fresh', 'cup', 'tbsp', 'package', 'large', 'small', 'cloves'].includes(w.toLowerCase()));
      if (mainWord) {
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
  if (titleLower.includes('cake') || titleLower.includes('cookie') || titleLower.includes('pudding') || titleLower.includes('dessert') || titleLower.includes('brownie')) tags.add('#DessertRecipes');
  if (titleLower.includes('steak') || titleLower.includes('chicken') || titleLower.includes('salmon') || titleLower.includes('beef') || titleLower.includes('pork')) tags.add('#DinnerIdeas');

  tags.add('#EasyRecipes');
  return Array.from(tags).slice(0, 7).join(' ');
}

/**
 * Verify Gemini API Key
 */
export async function testGeminiApiKey(apiKey: string): Promise<GeminiTestResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: 'Please enter a Gemini API Key.' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanKey}`;
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
        message: '✨ Gemini API Key verified and active!'
      };
    }

    return {
      success: false,
      message: 'Gemini API responded with no content.'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Network error verifying Gemini key: ${error.message || 'Check your internet connection'}`
    };
  }
}

/**
 * Format Full Social Media Recipe Caption (Deterministic 5-Section Architecture)
 */
export function formatCompleteSocialCaption(recipe: RecipeData, viralHook?: string, customHashtags?: string[]): string {
  const brandName = recipe.brandName || 'SnapRecipes';
  const rawUrl = recipe.ctaUrl || 'snaprecipes.xyz';
  const ctaUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  const teaser = cleanTeaser(viralHook || recipe.shortHook || `Better than takeout and ready in ${recipe.cookTime || recipe.prepTime}`);
  const hook = `${teaser} ${recipe.ingredients.length} ingredients, ${recipe.method.length} steps. 🍽️`;

  // Format all ingredients cleanly
  const ingredientsList = recipe.ingredients
    .map(ing => `- ${ing.name}${ing.amount ? ' — ' + ing.amount : ''}`)
    .join('\n');

  // Format all method steps cleanly
  const stepsList = recipe.method
    .map((step, idx) => `${idx + 1}. ${step}`)
    .join('\n');

  const tagList = generateRelevantHashtags(recipe, customHashtags);

  return `${recipe.title} — ${hook}

What you need:
${ingredientsList}

How to:
${stepsList}

Prep ${recipe.prepTime} · Cook ${recipe.cookTime} · Makes ${recipe.servings} · cal ${recipe.calories || 'N/A'}

Save this recipe on ${brandName} — skip the life story, get straight to cooking. Get the app: ${ctaUrl}

${tagList}`.trim();
}

/**
 * Format Short Social Media Caption (Exact Reference Formula)
 * Format: [Title in TitleCase] — [1 Complete Teaser Sentence]. [X] ingredients, [Y] steps, [Time]. 🍽️
 */
export function formatShortSocialCaption(recipe: RecipeData, viralTeaser?: string, customHashtags?: string[]): string {
  const brandName = recipe.brandName || 'SnapRecipes';
  const rawUrl = recipe.ctaUrl || 'snaprecipes.xyz';
  const ctaUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  const formattedTitle = toTitleCase(recipe.title);
  const teaser = cleanTeaser(viralTeaser || recipe.shortHook || 'Better than takeout and ready in minutes.');

  // Total time
  const totalTime = recipe.cookTime || recipe.prepTime || '30 min';
  const cleanTime = totalTime.replace(/\s*min(?:utes?)?/i, ' min').replace(/m$/, ' min');
  const statsLine = `${recipe.ingredients.length} ingredients, ${recipe.method.length} steps, ${cleanTime}. 🍽️`;

  const tagList = generateRelevantHashtags(recipe, customHashtags);

  return `${formattedTitle} — ${teaser} ${statsLine}

Save this recipe on ${brandName} — skip the life story, get straight to cooking. Get the app: ${ctaUrl}

${tagList}`.trim();
}

/**
 * Fallback Local Caption Generator
 */
export function generateLocalSocialCaption(recipe: RecipeData, mode: 'long' | 'short' = 'long'): string {
  return mode === 'short' 
    ? formatShortSocialCaption(recipe) 
    : formatCompleteSocialCaption(recipe);
}

/**
 * Generate Both Long and Short Social Media Captions with Gemini AI
 */
export async function generateBothSocialCaptions(
  recipe: RecipeData,
  apiKey?: string
): Promise<DualSocialCaptions> {
  const cleanKey = (apiKey || localStorage.getItem('slyde_gemini_api_key') || '').trim();

  let hook: string | undefined = undefined;
  let hashtags: string[] = [];

  if (cleanKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanKey}`;
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
- "hashtags" MUST be 5-6 highly relevant, specific hashtags tailored to this exact recipe dish name, main ingredients, and style (e.g. #CrabRangoon, #Nachos, #AppetizerIdeas, #GameDayFood).`;

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
            if (parsed.teaser && parsed.teaser.length > 5) {
              hook = parsed.teaser;
            }
            if (Array.isArray(parsed.hashtags) && parsed.hashtags.length > 0) {
              hashtags = parsed.hashtags;
            }
          } catch (e) {
            hook = rawText.replace(/^["']|["']$/g, '').trim();
          }
        }
      }
    } catch (error) {
      console.warn('Gemini hook generation fallback', error);
    }
  }

  return {
    long: formatCompleteSocialCaption(recipe, hook, hashtags.length > 0 ? hashtags : undefined),
    short: formatShortSocialCaption(recipe, hook, hashtags.length > 0 ? hashtags : undefined),
    hook: hook || recipe.shortHook,
    hashtags
  };
}

/**
 * Generate Social Media Caption with Gemini AI
 */
export async function generateSocialCaptionWithGemini(
  recipe: RecipeData,
  apiKey?: string,
  mode: 'long' | 'short' = 'long'
): Promise<string> {
  const both = await generateBothSocialCaptions(recipe, apiKey);
  return mode === 'short' ? both.short : both.long;
}
