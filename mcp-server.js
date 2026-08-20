#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function decodeEntities(str) {
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

// Recipe Extractor
async function extractRecipe(recipeUrl) {
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

  let recipeObj = null;
  const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const m of match) {
    try {
      const jsonStr = m.replace(/<script.*?>|<\/script>/gi, '').trim();
      const parsed = JSON.parse(jsonStr);
      const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
      const found = list.find(i => {
        if (!i) return false;
        const type = i['@type'];
        if (typeof type === 'string') return type.toLowerCase() === 'recipe';
        if (Array.isArray(type)) return type.some(t => String(t).toLowerCase() === 'recipe');
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
  const ingredients = rawIngredients.slice(0, 12).map(i => decodeEntities(i).trim());

  let method = [];
  if (Array.isArray(recipeObj?.recipeInstructions)) {
    method = recipeObj.recipeInstructions.map(s => {
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

// Generate Social Media Caption
async function generateSocialCaption(recipe, options = {}) {
  let geminiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || '';
  if (!geminiKey) {
    const confPath = path.resolve(__dirname, 'gemini_config.json');
    if (fs.existsSync(confPath)) {
      try {
        const d = JSON.parse(fs.readFileSync(confPath, 'utf8'));
        if (d.apiKey) geminiKey = d.apiKey;
      } catch (e) {}
    }
  }

  const brandName = options.brandName || process.env.BRAND_NAME || 'SnapRecipes';
  const ctaUrl = options.ctaUrl || process.env.CTA_URL || 'https://snaprecipes.xyz';
  const brandTag = brandName.replace(/\s+/g, '');

  let hook = `Better than takeout and ready in ${recipe.cookTime || recipe.prepTime}. ${recipe.ingredients.length} ingredients, ${recipe.method.length} steps. 🍽️`;

  if (geminiKey) {
    try {
      const prompt = `Write a punchy, viral 1-sentence social media hook for this recipe: "${recipe.title}".
Mention time (${recipe.cookTime || recipe.prepTime}), ${recipe.ingredients.length} ingredients, and ${recipe.method.length} steps.
Example: "Better than takeout and ready in 30 minutes. 7 ingredients, 5 steps, 30 min. 🍽️"
Return ONLY the 1-sentence hook ending with 🍽️.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
        })
      });
      const d = await res.json();
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (txt && txt.length > 8) {
        hook = txt.replace(/^["']|["']$/g, '').trim();
      }
    } catch (e) {}
  }

  const ingList = recipe.ingredients.map(i => typeof i === 'string' ? `- ${i}` : `- ${i.name}${i.amount ? ' — ' + i.amount : ''}`).join('\n');
  const stepsList = recipe.method.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
  const firstWord = recipe.title.split(' ')[0].replace(/[^a-zA-Z]/g, '');

  return `${recipe.title} — ${hook}

What you need:
${ingList}

How to:
${stepsList}

Prep ${recipe.prepTime} · Cook ${recipe.cookTime} · Makes ${recipe.servings} · cal ${recipe.calories || 'N/A'}

Save this recipe on ${brandName} — skip the life story, get straight to cooking. Get the app: ${ctaUrl}

#${brandTag} #EasyRecipes #RecipeIdeas #HealthyEating #${firstWord}`.trim();
}

// Initialize MCP Server
const server = new Server(
  {
    name: 'slyde-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// List Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'recipe://themes',
        name: 'Slyde Color Themes',
        mimeType: 'application/json',
        description: 'Available color palettes for rendering high-conversion recipe slideshows'
      }
    ]
  };
});

// Read Resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'recipe://themes') {
    return {
      contents: [
        {
          uri: 'recipe://themes',
          mimeType: 'application/json',
          text: JSON.stringify(THEMES, null, 2)
        }
      ]
    };
  }
  throw new Error(`Resource not found: ${request.params.uri}`);
});

// List Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'extract_recipe',
        description: 'Extract structured recipe data (title, ingredients, method steps, prep/cook time, calories, and hero image) from any recipe URL (AllRecipes, NYT Cooking, food blogs, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The full URL of the recipe webpage'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'generate_social_caption',
        description: 'Generate a high-converting, complete 5-section social media recipe caption (Title & Viral Hook, What you need, How to, Timing & Calorie stats, App CTA link, and Hashtags) using Gemini AI.',
        inputSchema: {
          type: 'object',
          properties: {
            recipe: {
              type: 'object',
              description: 'Structured recipe data object containing title, ingredients, method, prepTime, cookTime, servings, calories'
            },
            brandName: {
              type: 'string',
              description: 'Optional custom brand name (default: SnapRecipes)'
            },
            ctaUrl: {
              type: 'string',
              description: 'Optional custom app/website CTA link (default: https://snaprecipes.xyz)'
            }
          },
          required: ['recipe']
        }
      },
      {
        name: 'list_themes',
        description: 'List all 10 available visual color themes (Caramel, Noir, Sage, Berry, Sunset, Clean, Matcha, Terracotta, Lavender, Cobalt) for designing slideshow decks.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'create_recipe_deck',
        description: 'Extracts a recipe from a URL, selects a theme, and returns the complete 3-slide visual schema ready for slide export and social publishing.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The recipe URL to extract and format into a 3-slide deck'
            },
            themeId: {
              type: 'string',
              description: 'Optional theme ID (caramel, noir, sage, berry, sunset, clean, matcha, terracotta, lavender, cobalt)'
            }
          },
          required: ['url']
        }
      }
    ]
  };
});

// Call Tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'extract_recipe') {
      const { url } = args;
      const data = await extractRecipe(url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    }

    if (name === 'generate_social_caption') {
      const { recipe, brandName, ctaUrl } = args;
      const caption = await generateSocialCaption(recipe, { brandName, ctaUrl });
      return {
        content: [
          {
            type: 'text',
            text: caption
          }
        ]
      };
    }

    if (name === 'list_themes') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(THEMES, null, 2)
          }
        ]
      };
    }

    if (name === 'create_recipe_deck') {
      const { url, themeId = 'caramel' } = args;
      const recipe = await extractRecipe(url);
      const caption = await generateSocialCaption(recipe);
      const selectedTheme = THEMES.find(t => t.id === themeId) || THEMES[0];

      const deck = {
        recipe,
        theme: selectedTheme,
        socialCaption: caption,
        slides: [
          { slide: 1, type: 'hero_hook', title: recipe.title, image: recipe.imageUrl, stats: { prep: recipe.prepTime, cook: recipe.cookTime, servings: recipe.servings } },
          { slide: 2, type: 'recipe_card', ingredients: recipe.ingredients, method: recipe.method },
          { slide: 3, type: 'brand_cta', brand: 'SnapRecipes', url: 'https://snaprecipes.xyz' }
        ]
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(deck, null, 2)
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${error.message}`
        }
      ]
    };
  }
});

// Run server with STDIO transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Slyde MCP Server running on stdio');
}

run().catch((error) => {
  console.error('Fatal error running MCP server:', error);
  process.exit(1);
});
