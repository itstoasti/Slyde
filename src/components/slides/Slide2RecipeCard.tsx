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
      .replace(/completely smooth/gi, 'smooth')
      .replace(/room temperature/gi, 'room temp')
      .trim();

    if (clean.length > 130) {
      const sentences = clean.split(/(?<=[.!?])\s+/);
      let accum = '';
      for (const sent of sentences) {
        if (!accum) {
          accum = sent;
        } else if ((accum + ' ' + sent).length <= 135) {
          accum += ' ' + sent;
        } else {
          break;
        }
      }
      if (accum && accum.length >= 30) {
        clean = accum;
      }
    }

    if (clean.length > 140) {
      const cut = clean.substring(0, 135);
      const lastSpace = cut.lastIndexOf(' ');
      clean = (lastSpace > 80 ? cut.substring(0, lastSpace) : cut);
      clean = clean
        .replace(/,\s*(?:then|and|or|with|to|in|for|until|while|after|before|by|into|over|from)?\s*$/i, '')
        .replace(/\s+(?:then|and|or|with|to|in|for|until|while|after|before|by|into|over|from)\s*$/i, '')
        .trim();
      if (!/[.!?]$/.test(clean)) {
        clean += '...';
      }
    }
  }

  // Ensure step never ends with a dangling conjunction or preposition
  clean = clean
    .replace(/,\s*(?:then|and|or|with|to|in|for|until|while|after|before|by|into|over|from)\s*\.{0,3}$/i, '.')
    .replace(/\s+(?:then|and|or|with|to|in|for|until|while|after|before|by|into|over|from)\s*\.{0,3}$/i, '.');

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
    .replace(/\(just for dusting\)/gi, '(optional)')
    .replace(/\(for dusting\)/gi, '(dusting)')
    .replace(/\(room temperature\)/gi, '(room temp)')
    .replace(/,\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedIngredient {
  amount: string;
  name: string;
}

// Separates amount & unit from item name so amounts can be styled prominently
function parseIngredient(rawName: string, rawAmount?: string): ParsedIngredient {
  let name = (rawName || '').trim();
  let amount = (rawAmount || '').trim();

  if (!amount && name) {
    // 1 16-ounce container cottage cheese -> amount: 16 oz, name: cottage cheese
    const containerMatch = name.match(/^(\d+\s+)?(\d+[\s-]ounce|\d+[\s-]oz)\s+(?:container|tub|pack|can|package|block|jar)\s+(?:of\s+)?(.*)/i);
    if (containerMatch) {
      amount = containerMatch[2].replace(/[\s-]ounce/i, ' oz').replace(/[\s-]oz/i, ' oz');
      name = containerMatch[3];
    } else {
      // Numbers with units: e.g. "1/3 cup sugar", "1 tsp vanilla"
      const unitMatch = name.match(/^([\d/.-]+(?:\s*-\s*[\d/.-]+)?(?:\s+[\d/.-]+)?)\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|ounces?|oz|grams?|g|kg|ml|liters?|pinches|pinch|cloves?|slices?|cans?|stalks?|sprigs?|bunch(?:es)?|packages?|pkgs?|medium|large|small)?\b(?:\s+(?:of\s+)?)(.*)/i);
      if (unitMatch) {
        const qty = unitMatch[1].trim();
        const unit = (unitMatch[2] || '').trim();
        amount = unit ? `${qty} ${unit}` : qty;
        name = unitMatch[3].trim();
      } else {
        // Just number or range: e.g. "11-12 Biscoff cookies", "3 eggs"
        const numOnlyMatch = name.match(/^([\d/.-]+(?:\s*-\s*[\d/.-]+)?)\s+(.*)/);
        if (numOnlyMatch) {
          amount = numOnlyMatch[1].trim();
          name = numOnlyMatch[2].trim();
        }
      }
    }
  }

  name = cleanIngredientForSlide(name);

  amount = amount
    .replace(/tablespoons?\b/gi, 'tbsp')
    .replace(/teaspoons?\b/gi, 'tsp')
    .replace(/ounces?\b/gi, 'oz')
    .replace(/pounds?\b/gi, 'lb')
    .replace(/grams?\b/gi, 'g')
    .trim();

  return { amount, name };
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

  // 1 or 2 columns for ingredients in 1:1, NEVER 3 cramped columns
  let computedColumns = config.ingredientColumns;
  if (computedColumns === 'auto') {
    if (aspectRatio === '1:1') {
      // 1:1 square has limited width: max 2 columns ensures legible text and zero truncation
      computedColumns = numIngs >= 4 ? '2' : '1';
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

  const isSplitHorizontal = aspectRatio === '1:1' && numIngs >= 9;

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
      <div className={`recipe-main-card card-style-${config.cardStyle} ${isHeavyContent ? 'card-heavy-content' : 'card-balanced-content'} ${isSplitHorizontal ? 'layout-split-horizontal' : ''}`}>
        {/* Ingredients Section */}
        <div className="recipe-section ingredients-section">
          <h3 className="section-title">
            <span className="section-bar">|</span> Ingredients ({recipe.ingredients.length})
          </h3>
          <div 
            className={`ingredients-grid cols-${computedColumns} ${numIngs >= 8 ? 'grid-dense' : ''}`}
          >
            {recipe.ingredients.map((ing, idx) => {
              const parsed = parseIngredient(ing.name, ing.amount);
              return (
                <div key={idx} className="ingredient-pill">
                  <span className="ing-dot"></span>
                  <span className="ing-text">
                    {parsed.amount && <span className="ing-amount-badge">{parsed.amount}</span>}
                    <span className="ing-name">{parsed.name}</span>
                  </span>
                </div>
              );
            })}
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
