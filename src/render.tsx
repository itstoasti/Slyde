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

  let prepTime = r.prepTime;
  let cookTime = r.cookTime;
  let servings = r.servings;
  let calories = r.calories;
  let proteinCallout = r.proteinCallout;

  // If ingredients or method are missing or contain old dummy placeholders, synthesize matching authentic recipe
  if (
    formattedIngs.length === 0 ||
    formattedMethod.length === 0 ||
    formattedIngs.some((i: any) => (i.name || '').includes('Core Protein') || (i.name || '').includes('Artisan Spice'))
  ) {
    const synth = synthesizeDishRecipe(cleanTitle, url);
    formattedIngs = synth.ingredients;
    formattedMethod = synth.method;
    if (!prepTime) prepTime = synth.prepTime;
    if (!cookTime) cookTime = synth.cookTime;
    if (!servings) servings = synth.servings;
    if (!calories) calories = synth.calories;
    if (!proteinCallout) proteinCallout = synth.proteinCallout;
  }

  let heroImage = r.heroImage || r.image;
  if (!heroImage) {
    heroImage = getFallbackImage(cleanTitle);
  }

  return {
    ...base,
    ...r,
    title: cleanTitle || base.title,
    shortHook: r.shortHook || base.shortHook,
    taglineBadge: r.taglineBadge || base.taglineBadge || 'EASY RECIPE',
    heroImage,
    prepTime: prepTime || base.prepTime || '10m',
    cookTime: cookTime || base.cookTime || '20m',
    servings: servings || base.servings || '4',
    calories: calories || base.calories || '350 cal',
    proteinCallout: proteinCallout || r.proteinCallout,
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
  };
};

const RenderApp: React.FC = () => {
  const [recipe, setRecipe] = useState<RecipeData>(RECIPE_PRESETS[0]);
  const [theme, setTheme] = useState<ThemeConfig>(THEME_PRESETS.caramel);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');

  useEffect(() => {
    window.__setRecipe = (newRecipe: any, newTheme?: ThemeConfig, newAspectRatio?: AspectRatio) => {
      setRecipe(normalizeRecipe(newRecipe));
      if (newTheme) setTheme(newTheme);
      if (newAspectRatio) setAspectRatio(newAspectRatio);
      window.__isReady = true;
    };
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
