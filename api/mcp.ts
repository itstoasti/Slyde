import type { VercelRequest, VercelResponse } from '@vercel/node';

// Available Color Themes
const THEMES = [
  { id: 'caramel', name: 'Caramel Popcorn', accent: '#f59e0b', bgDark: '#1c0a03', bgCard: '#2d140a' },
  { id: 'noir', name: 'Midnight Obsidian', accent: '#38bdf8', bgDark: '#0a0a0f', bgCard: '#13131a' },
  { id: 'sage', name: 'Avocado & Herb', accent: '#10b981', bgDark: '#071810', bgCard: '#0f291e' },
  { id: 'berry', name: 'Wild Acai', accent: '#ec4899', bgDark: '#1c0514', bgCard: '#2d0f23' },
  { id: 'sunset', name: 'Spicy Paprika', accent: '#f97316', bgDark: '#1c0903', bgCard: '#2d130a' },
  { id: 'clean', name: 'Nordic Clean', accent: '#6366f1', bgDark: '#0b0f19', bgCard: '#141a29' },
  { id: 'matcha', name: 'Matcha Latte', accent: '#84cc16', bgDark: '#0d1804', bgCard: '#182b09' },
  { id: 'terracotta', name: 'Warm Clay', accent: '#e07a5f', bgDark: '#1c0c08', bgCard: '#2d1712' },
  { id: 'lavender', name: 'Sweet Taro', accent: '#a855f7', bgDark: '#13081e', bgCard: '#211033' },
  { id: 'cobalt', name: 'Electric Cyan', accent: '#06b6d4', bgDark: '#04151b', bgCard: '#0a2630' }
];

function decodeEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
}

async function extractRecipeServer(recipeUrl: string) {
  let html = '';
  try {
    const res = await fetch(`https://r.jina.ai/${recipeUrl}`, {
      headers: { 'X-Return-Format': 'html' }
    });
    if (res.ok) html = await res.text();
  } catch (e) {}

  if (!html || html.length < 500) {
    try {
      const res = await fetch(recipeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (res.ok) html = await res.text();
    } catch (e) {}
  }

  let recipeObj: any = null;
  const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const m of match) {
    try {
      const jsonStr = m.replace(/<script.*?>|<\/script>/gi, '').trim();
      const parsed = JSON.parse(jsonStr);
      const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
      const found = list.find((i: any) => {
        if (!i) return false;
        const type = i['@type'];
        if (typeof type === 'string') return type.toLowerCase() === 'recipe';
        if (Array.isArray(type)) return type.some((t: any) => String(t).toLowerCase() === 'recipe');
        return false;
      });
      if (found) {
        recipeObj = found;
        break;
      }
    } catch (e) {}
  }

  const title = decodeEntities(recipeObj?.name || 'Delicious Recipe').trim();
  const prepTime = recipeObj?.prepTime || '10m';
  const cookTime = recipeObj?.cookTime || '15m';
  const servings = recipeObj?.recipeYield ? String(recipeObj.recipeYield).replace(/\D+/g, '') : '4';
  const calories = recipeObj?.nutrition?.calories ? `${recipeObj.nutrition.calories} cal` : 'N/A';

  const rawIngredients = Array.isArray(recipeObj?.recipeIngredient) ? recipeObj.recipeIngredient : [];
  const ingredients = rawIngredients.slice(0, 12).map((i: string) => decodeEntities(i).trim());

  let method: string[] = [];
  if (Array.isArray(recipeObj?.recipeInstructions)) {
    method = recipeObj.recipeInstructions.map((s: any) => {
      const txt = typeof s === 'string' ? s : (s.text || '');
      return decodeEntities(txt).replace(/^Step\s*\d+:\s*/i, '').replace(/^\d+\.\s*/, '').replace(/Recipe developed by.*/i, '').trim();
    }).filter(Boolean).slice(0, 8);
  }

  let imageUrl = '';
  if (typeof recipeObj?.image === 'string') {
    imageUrl = recipeObj.image;
  } else if (Array.isArray(recipeObj?.image) && recipeObj.image[0]) {
    imageUrl = typeof recipeObj.image[0] === 'string' ? recipeObj.image[0] : (recipeObj.image[0].url || '');
  } else if (recipeObj?.image?.url) {
    imageUrl = recipeObj.image.url;
  }

  if (!imageUrl) {
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch) imageUrl = ogMatch[1];
  }

  return {
    title,
    prepTime,
    cookTime,
    servings,
    calories,
    ingredients,
    method,
    imageUrl,
    sourceUrl: recipeUrl
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support both GET (discovery) and POST (JSON-RPC tool call)
  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'slyde-mcp-endpoint',
      description: 'Model Context Protocol (MCP) endpoint for Slyde Recipe Studio',
      version: '1.0.0',
      tools: [
        {
          name: 'extract_recipe',
          description: 'Extract structured recipe data from any URL',
          parameters: { url: 'string' }
        },
        {
          name: 'list_themes',
          description: 'List available visual color themes',
          parameters: {}
        },
        {
          name: 'create_recipe_deck',
          description: 'Extract recipe and generate a 3-slide visual schema',
          parameters: { url: 'string', themeId: 'string (optional)' }
        }
      ]
    });
  }

  const { jsonrpc = '2.0', id, method, params } = req.body || {};

  if (method === 'tools/list') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'extract_recipe',
            description: 'Extract structured recipe data from any URL',
            inputSchema: {
              type: 'object',
              properties: { url: { type: 'string' } },
              required: ['url']
            }
          },
          {
            name: 'list_themes',
            description: 'List 10 available color palettes',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'create_recipe_deck',
            description: 'Create complete 3-slide recipe deck schema',
            inputSchema: {
              type: 'object',
              properties: { url: { type: 'string' }, themeId: { type: 'string' } },
              required: ['url']
            }
          }
        ]
      }
    });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};

    if (name === 'extract_recipe') {
      const data = await extractRecipeServer(args?.url);
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        }
      });
    }

    if (name === 'list_themes') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(THEMES, null, 2) }]
        }
      });
    }

    if (name === 'create_recipe_deck') {
      const recipe = await extractRecipeServer(args?.url);
      const selectedTheme = THEMES.find(t => t.id === args?.themeId) || THEMES[0];
      const deck = {
        recipe,
        theme: selectedTheme,
        slides: [
          { slide: 1, type: 'hero_hook', title: recipe.title, image: recipe.imageUrl },
          { slide: 2, type: 'recipe_card', ingredients: recipe.ingredients, method: recipe.method },
          { slide: 3, type: 'brand_cta', brand: 'SnapRecipes', url: 'https://snaprecipes.xyz' }
        ]
      };
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(deck, null, 2) }]
        }
      });
    }
  }

  return res.status(200).json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: 'Method not found' }
  });
}
