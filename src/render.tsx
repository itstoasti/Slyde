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

const RenderApp: React.FC = () => {
  const [recipe, setRecipe] = useState<RecipeData>(RECIPE_PRESETS[0]);
  const [theme, setTheme] = useState<ThemeConfig>(THEME_PRESETS.caramel);

  useEffect(() => {
    window.__setRecipe = (newRecipe: RecipeData, newTheme?: ThemeConfig) => {
      setRecipe(newRecipe);
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
