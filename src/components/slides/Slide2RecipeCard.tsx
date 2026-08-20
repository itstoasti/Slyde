import React from 'react';
import { RecipeData, ThemeConfig, AspectRatio, Slide2LayoutConfig } from '../../types';
import { getProxiedImageUrl } from '../../utils/imageProxy';

interface Slide2RecipeCardProps {
  recipe: RecipeData;
  theme: ThemeConfig;
  aspectRatio: AspectRatio;
}

export const Slide2RecipeCard: React.FC<Slide2RecipeCardProps> = ({ recipe, theme, aspectRatio }) => {
  const config: Slide2LayoutConfig = recipe.slide2Config || {
    density: 'auto',
    ingredientColumns: 'auto',
    fontScale: 1.0,
    splitProportion: 'auto',
    showThumbnail: true,
    cardStyle: 'cream'
  };

  const numIngs = recipe.ingredients.length;
  const numSteps = recipe.method.length;
  const methodChars = recipe.method.join('').length;
  const ingChars = recipe.ingredients.map(i => i.name + (i.amount || '')).join('').length;

  // Content Weight Scoring System
  const contentScore = (numSteps * 35) + (numIngs * 15) + (methodChars * 0.6) + (ingChars * 0.2);
  const isHeavyContent = contentScore > 400 || numSteps >= 5 || numIngs >= 8;

  // Intelligent Automatic Layout Balancing Engine
  let computedDensity = config.density;
  if (computedDensity === 'auto') {
    if (contentScore > 480 || numSteps >= 6) {
      computedDensity = 'micro';
    } else if (contentScore > 320 || numIngs > 5 || numSteps > 4) {
      computedDensity = 'compact';
    } else if (contentScore < 180 && numSteps <= 3) {
      computedDensity = 'spacious';
    } else {
      computedDensity = 'standard';
    }
  }

  // Automatic Column Determination (2 columns for 5+ ingredients to save vertical height)
  let computedColumns = config.ingredientColumns;
  if (computedColumns === 'auto') {
    if (numIngs >= 5) {
      computedColumns = '2';
    } else {
      computedColumns = '1';
    }
  }

  // Smooth Proportional Auto-Fit Font Scaling
  let autoFontScale = config.fontScale || 1.0;
  if (config.fontScale) {
    autoFontScale = config.fontScale;
  } else if (contentScore > 650) {
    autoFontScale = 0.68;
  } else if (contentScore > 500) {
    autoFontScale = 0.73;
  } else if (contentScore > 380) {
    autoFontScale = 0.80;
  } else if (contentScore > 260) {
    autoFontScale = 0.88;
  } else {
    autoFontScale = 1.0;
  }

  // Background style based on cardStyle
  let cardBg = theme.bgCard;
  let textDark = theme.textDark;
  let textMuted = theme.textMuted;
  if (config.cardStyle === 'pure-white') {
    cardBg = '#ffffff';
  } else if (config.cardStyle === 'soft-warm') {
    cardBg = '#fff8f2';
  } else if (config.cardStyle === 'dark-glass') {
    cardBg = 'rgba(25, 20, 15, 0.94)';
    textDark = '#f3f4f6';
    textMuted = '#9ca3af';
  }

  const proxiedImage = getProxiedImageUrl(recipe.heroImage);

  return (
    <div
      className={`slide-container slide-2 aspect-${aspectRatio.replace(':', '-')} density-${computedDensity}`}
      style={{
        '--accent-color': theme.accent,
        '--bg-dark': theme.bgDark,
        '--bg-card': cardBg,
        '--text-dark': textDark,
        '--text-muted': textMuted,
        '--pill-num-bg': theme.pillNumberBg,
        '--pill-num-text': theme.pillNumberText,
        '--font-scale': autoFontScale
      } as React.CSSProperties}
    >
      {/* Top Card Header inside Safe Area */}
      <div className="card-top-header">
        <div className="card-header-left">
          <span className="card-eyebrow">RECIPE CARD</span>
          <h2 className="card-title" style={{ fontSize: `calc(1.15rem * ${autoFontScale})` }}>
            {recipe.title}
          </h2>
        </div>
        {config.showThumbnail && proxiedImage && (
          <div className="card-header-thumbnail">
            <img src={proxiedImage} alt={recipe.title} crossOrigin="anonymous" />
          </div>
        )}
      </div>

      {/* Main Container Card inside Safe Area */}
      <div className={`recipe-main-card card-style-${config.cardStyle} ${isHeavyContent ? 'card-heavy-content' : 'card-balanced-content'}`}>
        {/* Ingredients Section */}
        <div className="recipe-section ingredients-section">
          <h3 className="section-title" style={{ fontSize: `calc(0.85rem * ${autoFontScale})` }}>
            <span className="section-bar">|</span> Ingredients ({recipe.ingredients.length})
          </h3>
          <div 
            className={`ingredients-grid cols-${computedColumns} ${numIngs >= 8 ? 'grid-dense' : ''}`}
          >
            {recipe.ingredients.map((ing, idx) => (
              <div key={idx} className="ingredient-pill">
                <span className="ing-dot"></span>
                <span className="ing-text">
                  <span className="ing-name">{ing.name}</span>
                  {ing.amount && <span className="ing-amount"> — {ing.amount}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Method Section */}
        <div className="recipe-section method-section">
          <h3 className="section-title" style={{ fontSize: `calc(0.85rem * ${autoFontScale})` }}>
            <span className="section-bar">|</span> Method ({recipe.method.length} steps)
          </h3>
          <div className="method-list">
            {recipe.method.map((step, idx) => (
              <div key={idx} className="method-step-item">
                <div className="step-number-badge">{idx + 1}</div>
                <div className="step-text">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Macro Strip inside Safe Area */}
      <div className="card-safe-stat-bar">
        <span className="safe-stat-item">⏱️ {recipe.prepTime} PREP</span>
        <span className="safe-stat-divider">·</span>
        <span className="safe-stat-item">🔥 {recipe.cookTime} COOK</span>
        <span className="safe-stat-divider">·</span>
        <span className="safe-stat-item">🍽️ {recipe.servings} SERVES</span>
      </div>
    </div>
  );
};
