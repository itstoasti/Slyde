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
  const totalChars = methodChars + recipe.ingredients.map(i => i.name + (i.amount || '')).join('').length;

  const isHeavyContent = totalChars > 420 || numSteps >= 5 || (numSteps >= 4 && numIngs >= 7);

  // Density class
  let computedDensity = config.density;
  if (computedDensity === 'auto') {
    if (aspectRatio === '1:1') {
      if (numSteps >= 5 || totalChars > 340 || numIngs >= 6) {
        computedDensity = 'micro';
      } else if (numSteps >= 4 || numIngs >= 4 || totalChars > 220) {
        computedDensity = 'compact';
      } else {
        computedDensity = 'standard';
      }
    } else {
      if (numSteps >= 5 || totalChars > 360 || numIngs >= 7) {
        computedDensity = 'micro';
      } else if (numSteps >= 4 || numIngs >= 5 || totalChars > 260) {
        computedDensity = 'compact';
      } else if (numIngs <= 4 && numSteps <= 3 && totalChars < 180) {
        computedDensity = 'spacious';
      } else {
        computedDensity = 'standard';
      }
    }
  }

  // 2, 3 or 4 columns for ingredients to minimize vertical space
  let computedColumns = config.ingredientColumns;
  if (computedColumns === 'auto') {
    if (aspectRatio === '1:1') {
      computedColumns = numIngs >= 9 ? '4' : numIngs >= 5 ? '3' : numIngs >= 3 ? '2' : '1';
    } else {
      computedColumns = numIngs >= 8 ? '3' : numIngs >= 4 ? '2' : '1';
    }
  }

  // Proportional Auto-Fit Font Scaling
  let autoFontScale = 1.0;
  if (recipe.slide2Config?.fontScale && recipe.slide2Config.fontScale !== 1.0) {
    autoFontScale = recipe.slide2Config.fontScale;
  } else if (aspectRatio === '1:1') {
    if (totalChars > 1100 || (numSteps >= 5 && methodChars > 650)) {
      autoFontScale = 0.67;
    } else if (totalChars > 750 || (numSteps >= 5 && methodChars > 450)) {
      autoFontScale = 0.72;
    } else if (numSteps >= 6 || totalChars > 450) {
      autoFontScale = 0.76;
    } else if (numSteps >= 5 || totalChars > 320) {
      autoFontScale = 0.80;
    } else if (numSteps >= 4 || totalChars > 220) {
      autoFontScale = 0.86;
    } else {
      autoFontScale = 0.92;
    }
  } else if (numSteps >= 6 || totalChars > 500) {
    autoFontScale = 0.74;
  } else if (numSteps >= 5 || totalChars > 360) {
    autoFontScale = 0.80;
  } else if (numSteps >= 4 || totalChars > 260) {
    autoFontScale = 0.86;
  } else {
    autoFontScale = 0.94;
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
          <h2 className="card-title">
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
          <h3 className="section-title">
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
          <h3 className="section-title">
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
