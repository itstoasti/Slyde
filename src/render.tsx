import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RecipeData, ThemeConfig, AspectRatio } from './types';
import { RECIPE_PRESETS, THEME_PRESETS } from './data/presets';
import { DEFAULT_BRAND_LOGO } from './assets/defaultBrandLogo';
import { Slide1Hero } from './components/slides/Slide1Hero';
import { Slide2RecipeCard } from './components/slides/Slide2RecipeCard';
import { Slide3CTA } from './components/slides/Slide3CTA';
import { cleanRecipeTitle, synthesizeDishRecipe, getFallbackImage } from './utils/recipeExtractor';
import './index.css';

declare global {
  interface Window {
    __setRecipe: (recipe: RecipeData, theme?: ThemeConfig, aspectRatio?: AspectRatio) => void;
    __isReady: boolean;
  }
}

let globalSetRecipeHandler: ((recipe: any, theme?: ThemeConfig, aspectRatio?: AspectRatio) => void) | null = null;
let pendingRecipeCall: { recipe: any; theme?: ThemeConfig; aspectRatio?: AspectRatio } | null = null;

if (typeof window !== 'undefined') {
  window.__setRecipe = (newRecipe: any, newTheme?: ThemeConfig, newAspectRatio?: AspectRatio) => {
    if (globalSetRecipeHandler) {
      globalSetRecipeHandler(newRecipe, newTheme, newAspectRatio);
    } else {
      pendingRecipeCall = { recipe: newRecipe, theme: newTheme, aspectRatio: newAspectRatio };
    }
    window.__isReady = true;
  };
  window.__isReady = true;
}

const normalizeRecipe = (r: any): RecipeData => {
  const base = RECIPE_PRESETS[0];
  if (!r) return base;

  const url = r.sourceUrl || r.url || '';
  const rawTitle = r.title || r.name || '';
  const cleanTitle = cleanRecipeTitle(rawTitle, url).toUpperCase();

  // Format ingredients to { name, amount }
  let formattedIngs: { name: string; amount: string }[] = [];
  if (Array.isArray(r.ingredients) && r.ingredients.length > 0) {
    formattedIngs = r.ingredients.map((ing: any) => {
      if (typeof ing === 'string') {
        const parts = ing.trim().split(' ');
        if (parts.length > 1 && /^[\d/.-]+/.test(parts[0])) {
          return { amount: parts.slice(0, 2).join(' '), name: parts.slice(2).join(' ') || parts[1] };
        }
        return { amount: '', name: ing };
      }
      return { name: ing.name || 'Ingredient', amount: ing.amount || '' };
    }).filter((i: { name: string; amount: string }) => i.name && i.name.toLowerCase() !== 'ingredient');
  }

  // Format method/instructions to string[]
  let formattedMethod: string[] = [];
  if (Array.isArray(r.method) && r.method.length > 0) {
    formattedMethod = r.method;
  } else if (Array.isArray(r.instructions) && r.instructions.length > 0) {
    formattedMethod = r.instructions;
  }

  let prepTime = r.prepTime || '10m';
  let cookTime = r.cookTime || '15m';
  let servings = r.servings || '4';
  let calories = r.calories || '350 cal';
  let proteinCallout = r.proteinCallout || 'High protein';

  // If ingredients or method are missing or contain old dummy placeholders, synthesize matching authentic recipe
  if (
    formattedIngs.length === 0 ||
    formattedMethod.length === 0 ||
    formattedIngs.some((i: any) => (i.name || '').includes('Core Protein') || (i.name || '').includes('Artisan Spice'))
  ) {
    const synth = synthesizeDishRecipe(cleanTitle, url);
    formattedIngs = synth.ingredients;
    formattedMethod = synth.method;
    if (!r.prepTime) prepTime = synth.prepTime;
    if (!r.cookTime) cookTime = synth.cookTime;
    if (!r.servings) servings = synth.servings;
    if (!r.calories) calories = synth.calories;
    if (!r.proteinCallout) proteinCallout = synth.proteinCallout;
  }

  let heroImage = r.heroImage || r.image;
  if (!heroImage) {
    heroImage = getFallbackImage(cleanTitle);
  }

  const shortHook = r.shortHook || `Better than takeout and ready in ${cookTime || prepTime}. ${formattedIngs.length} ingredients, easy steps. 🍽️`;

  return {
    id: r.id || `recipe-${Date.now()}`,
    title: cleanTitle || 'AUTHENTIC RECIPE',
    shortHook,
    taglineBadge: r.taglineBadge || `• ${(r.brandName || base.brandName).toUpperCase()} · SKIP THE LIFE STORY`,
    heroImage,
    prepTime,
    cookTime,
    servings,
    calories,
    proteinCallout,
    highlightBadge: `${prepTime.toUpperCase()} · ${servings} SERVINGS`,
    ingredients: formattedIngs,
    method: formattedMethod,
    brandName: r.brandName || base.brandName,
    brandSubtitle: r.brandSubtitle || base.brandSubtitle,
    brandPillBadge: r.brandPillBadge || base.brandPillBadge,
    brandLogo: (!r.brandLogo || r.brandLogo === '/snaprecipes-app-icon.png') ? DEFAULT_BRAND_LOGO : r.brandLogo,
    brandLogoSize: r.brandLogoSize || base.brandLogoSize || 58,
    ctaButtonText: r.ctaButtonText || base.ctaButtonText,
    ctaUrl: r.ctaUrl || base.ctaUrl,
    socialHandle: r.socialHandle || base.socialHandle,
    perks: Array.isArray(r.perks) && r.perks.length > 0 ? r.perks : base.perks,
    slide2Config: r.slide2Config || base.slide2Config
  };
};

const RenderApp: React.FC = () => {
  const [recipe, setRecipe] = useState<RecipeData>(() => {
    if (pendingRecipeCall?.recipe) return normalizeRecipe(pendingRecipeCall.recipe);
    return RECIPE_PRESETS[0];
  });
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    if (pendingRecipeCall?.theme) return pendingRecipeCall.theme;
    return THEME_PRESETS.caramel;
  });
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => {
    if (pendingRecipeCall?.aspectRatio) return pendingRecipeCall.aspectRatio;
    return '9:16';
  });

  useEffect(() => {
    globalSetRecipeHandler = (newRecipe: any, newTheme?: ThemeConfig, newAspectRatio?: AspectRatio) => {
      setRecipe(normalizeRecipe(newRecipe));
      if (newTheme) setTheme(newTheme);
      if (newAspectRatio) setAspectRatio(newAspectRatio);
      window.__isReady = true;
    };

    if (pendingRecipeCall) {
      setRecipe(normalizeRecipe(pendingRecipeCall.recipe));
      if (pendingRecipeCall.theme) setTheme(pendingRecipeCall.theme);
      if (pendingRecipeCall.aspectRatio) setAspectRatio(pendingRecipeCall.aspectRatio);
      pendingRecipeCall = null;
    }
    window.__isReady = true;
  }, []);

  const slideHeight = aspectRatio === '1:1' ? 360 : aspectRatio === '4:5' ? 450 : 640;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: 20, background: '#0c0a09', width: 'fit-content' }}>
      <div 
        id="slide-1" 
        style={{ 
          width: 360, 
          height: slideHeight, 
          overflow: 'hidden', 
          position: 'relative',
          background: '#000',
          borderRadius: 0 
        }}
      >
        <Slide1Hero recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
      </div>

      <div 
        id="slide-2" 
        style={{ 
          width: 360, 
          height: slideHeight, 
          overflow: 'hidden', 
          position: 'relative',
          background: '#000',
          borderRadius: 0 
        }}
      >
        <Slide2RecipeCard recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
      </div>

      <div 
        id="slide-3" 
        style={{ 
          width: 360, 
          height: slideHeight, 
          overflow: 'hidden', 
          position: 'relative',
          background: '#000',
          borderRadius: 0 
        }}
      >
        <Slide3CTA recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
      </div>
    </div>
  );
};

const rootEl = document.getElementById('render-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<RenderApp />);
}
