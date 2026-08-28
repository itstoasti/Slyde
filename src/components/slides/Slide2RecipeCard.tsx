import React from 'react';
import { RecipeData, ThemeConfig, AspectRatio, Slide2LayoutConfig } from '../../types';
import { getProxiedImageUrl } from '../../utils/imageProxy';

interface Slide2RecipeCardProps {
  recipe: RecipeData;
  theme: ThemeConfig;
  aspectRatio: AspectRatio;
}

// Cleans up conversational blog filler for punchy, high-legibility slide cards
function simplifyStepForSlide(step: string, isCompactMode: boolean): string {
  if (!step) return '';
  let clean = step.trim()
    .replace(/^Step\s*\d+[:.]\s*/i, '')
    .replace(/^\d+[:.]\s*/, '')
    .replace(/Recipe developed by.*/i, '')
    .replace(/\s+Enjoy!?$/i, '')
    .replace(/\s+/g, ' ');

  if (isCompactMode) {
    clean = clean
      .replace(/together in a large bowl/gi, 'in a bowl')
      .replace(/together in a bowl/gi, 'in a bowl')
      .replace(/in a separate bowl,?\s*/gi, 'separately, ')
      .replace(/In a separate bowl,?\s*/gi, 'Separately, ')
      .replace(/for dipping\.?\s*/gi, '. ')
      .replace(/You may have to work in batches\.?\s*/gi, '')
      .replace(/Repeat with remaining fritter batter\.?\s*/gi, '')
      .replace(/Repeat with remaining.*?\./gi, '')
      .replace(/Check the consistency of the batter\.\s*/gi, '')
      .replace(/Pour enough oil to generously coat the bottom of a large nonstick pan\.\s*/gi, 'Heat oil in pan. ')
      .replace(/Heat the oil to medium-high\.\s*/gi, 'Heat over medium-high. ')
      .replace(/Using a \d+[\s-]ounce (?:ice cream )?scoop,?\s*/gi, 'Scoop ')
      .replace(/portion the batter into the hot oil\.\s*/gi, 'batter into pan. ')
      .replace(/Turn over and press down slightly\.\s*Turn again and fry/gi, 'Flip, press slightly, and fry')
      .replace(/Finish with one last drizzle of/gi, 'Top with')
      .replace(/Serve the warm corn fritters with a generous bowl of/gi, 'Serve warm fritters with')
      .replace(/Maldon salt, and a sprinkle of fresh chives/gi, 'flaky salt & chives')
      .trim();

    if (clean.length > 120) {
      const sentences = clean.split(/(?<=[.!?])\s+/);
      let accum = '';
      for (const sent of sentences) {
        if (!accum) {
          accum = sent;
        } else if ((accum + ' ' + sent).length <= 125) {
          accum += ' ' + sent;
        } else {
          break;
        }
      }
      if (accum && accum.length >= 30) {
        clean = accum;
      }
    }

    if (clean.length > 130) {
      const cut = clean.substring(0, 125);
      const lastSpace = cut.lastIndexOf(' ');
      clean = (lastSpace > 75 ? cut.substring(0, lastSpace) : cut) + '...';
    }
  }

  return clean;
}

// Cleans up wordy blog ingredient strings for compact, non-truncated slide cards
function cleanIngredientForSlide(name: string): string {
  if (!name) return '';
  return name.trim()
    .replace(/such as .*?(?=(,|$|\.))/gi, '')
    .replace(/,\s*such as.*/gi, '')
    .replace(/,\s*divided/gi, '')
    .replace(/,\s*cut from the cob/gi, '')
    .replace(/,\s*or to taste/gi, '')
    .replace(/,\s*plus more for serving/gi, '')
    .replace(/,\s*melted/gi, '')
    .replace(/freshly ground\s*/gi, '')
    .replace(/fresh cracked\s*/gi, '')
    .replace(/finely ground\s*/gi, '')
    .replace(/chopped fresh\s*/gi, '')
    .replace(/chopped\s*/gi, '')
    .replace(/all-purpose\s*/gi, 'AP ')
    .replace(/All-purpose\s*/gi, 'AP ')
    .replace(/tablespoons?\b/gi, 'tbsp')
    .replace(/teaspoons?\b/gi, 'tsp')
    .replace(/kernels\b/gi, '')
    .replace(/Maldon salt and fresh cracked black pepper/gi, 'Salt & black pepper')
    .replace(/Maldon salt and/gi, 'Salt &')
    .replace(/Dash of\s*/gi, '')
    .replace(/,\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

  // 2 or 3 columns for ingredients
  let computedColumns = config.ingredientColumns;
  if (computedColumns === 'auto') {
    if (aspectRatio === '1:1') {
      computedColumns = numIngs >= 6 ? '3' : numIngs >= 3 ? '2' : '1';
    } else {
      computedColumns = numIngs >= 8 ? '3' : numIngs >= 4 ? '2' : '1';
    }
  }

  // Proportional Auto-Fit Font Scaling with high minimum floor for accessibility & readability
  let autoFontScale = 1.0;
  if (recipe.slide2Config?.fontScale && recipe.slide2Config.fontScale !== 1.0) {
    autoFontScale = recipe.slide2Config.fontScale;
  } else if (aspectRatio === '1:1') {
    if (numSteps >= 6) {
      autoFontScale = 0.88;
    } else if (numSteps >= 5) {
      autoFontScale = 0.92;
    } else if (numSteps >= 4) {
      autoFontScale = 0.96;
    } else {
      autoFontScale = 1.0;
    }
  } else if (numSteps >= 6 || totalChars > 500) {
    autoFontScale = 0.84;
  } else if (numSteps >= 5 || totalChars > 360) {
    autoFontScale = 0.90;
  } else if (numSteps >= 4 || totalChars > 260) {
    autoFontScale = 0.94;
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
                  <span className="ing-name">{cleanIngredientForSlide(ing.name)}</span>
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
                <div className="step-text">{simplifyStepForSlide(step, isHeavyContent || aspectRatio === '1:1')}</div>
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
