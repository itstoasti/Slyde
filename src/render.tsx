import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RecipeData, ThemeConfig } from './types';
import { RECIPE_PRESETS, THEME_PRESETS } from './data/presets';
import { Slide1Hero } from './components/slides/Slide1Hero';
import { Slide2RecipeCard } from './components/slides/Slide2RecipeCard';
import { Slide3CTA } from './components/slides/Slide3CTA';
import './index.css';

declare global {
  interface Window {
    __setRecipe: (recipe: RecipeData, theme?: ThemeConfig) => void;
    __isReady: boolean;
  }
}

const normalizeRecipe = (r: any): RecipeData => {
  const base = RECIPE_PRESETS[0];
  if (!r) return base;

  // Format ingredients to { name, amount }
  let formattedIngs = base.ingredients;
  if (Array.isArray(r.ingredients) && r.ingredients.length > 0) {
    formattedIngs = r.ingredients.map((ing: any) => {
      if (typeof ing === 'string') {
        const parts = ing.trim().split(' ');
        if (parts.length > 1 && /^[\d/.-]+/.test(parts[0])) {
          return { amount: parts.slice(0, 2).join(' '), name: parts.slice(2).join(' ') || parts[1] };
        }
        return { amount: '1 item', name: ing };
      }
      return { name: ing.name || 'Ingredient', amount: ing.amount || '' };
    });
  }

  // Format method/instructions to string[]
  let formattedMethod = base.method;
  if (Array.isArray(r.method) && r.method.length > 0) {
    formattedMethod = r.method;
  } else if (Array.isArray(r.instructions) && r.instructions.length > 0) {
    formattedMethod = r.instructions;
  }

  return {
    ...base,
    ...r,
    title: r.title || base.title,
    shortHook: r.shortHook || base.shortHook,
    taglineBadge: r.taglineBadge || base.taglineBadge || 'EASY RECIPE',
    heroImage: r.heroImage || r.image || base.heroImage,
    prepTime: r.prepTime || base.prepTime || '10m',
    cookTime: r.cookTime || base.cookTime || '20m',
    servings: r.servings || base.servings || '4',
    calories: r.calories || base.calories || '350 cal',
    ingredients: formattedIngs,
    method: formattedMethod,
    brandName: r.brandName || base.brandName,
    brandSubtitle: r.brandSubtitle || base.brandSubtitle,
    brandPillBadge: r.brandPillBadge || base.brandPillBadge,
    ctaButtonText: r.ctaButtonText || base.ctaButtonText,
    ctaUrl: r.ctaUrl || base.ctaUrl,
    socialHandle: r.socialHandle || base.socialHandle,
    perks: Array.isArray(r.perks) && r.perks.length > 0 ? r.perks : base.perks,
  };
};

const RenderApp: React.FC = () => {
  const [recipe, setRecipe] = useState<RecipeData>(RECIPE_PRESETS[0]);
  const [theme, setTheme] = useState<ThemeConfig>(THEME_PRESETS.caramel);

  useEffect(() => {
    window.__setRecipe = (newRecipe: any, newTheme?: ThemeConfig) => {
      setRecipe(normalizeRecipe(newRecipe));
      if (newTheme) setTheme(newTheme);
      window.__isReady = true;
    };
    window.__isReady = true;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: 20, background: '#0c0a09', width: 'fit-content' }}>
      <div 
        id="slide-1" 
        style={{ 
          width: 360, 
          height: 640, 
          overflow: 'hidden', 
          position: 'relative',
          background: '#000',
          borderRadius: 0 
        }}
      >
        <Slide1Hero recipe={recipe} theme={theme} aspectRatio="9:16" />
      </div>

      <div 
        id="slide-2" 
        style={{ 
          width: 360, 
          height: 640, 
          overflow: 'hidden', 
          position: 'relative',
          background: '#000',
          borderRadius: 0 
        }}
      >
        <Slide2RecipeCard recipe={recipe} theme={theme} aspectRatio="9:16" />
      </div>

      <div 
        id="slide-3" 
        style={{ 
          width: 360, 
          height: 640, 
          overflow: 'hidden', 
          position: 'relative',
          background: '#000',
          borderRadius: 0 
        }}
      >
        <Slide3CTA recipe={recipe} theme={theme} aspectRatio="9:16" />
      </div>
    </div>
  );
};

const rootEl = document.getElementById('render-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<RenderApp />);
}
