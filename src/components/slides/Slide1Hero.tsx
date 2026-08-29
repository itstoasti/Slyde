import React from 'react';
import { RecipeData, ThemeConfig, AspectRatio } from '../../types';
import { getProxiedImageUrl } from '../../utils/imageProxy';

interface Slide1HeroProps {
  recipe: RecipeData;
  theme: ThemeConfig;
  aspectRatio: AspectRatio;
}

export const Slide1Hero: React.FC<Slide1HeroProps> = ({ recipe, theme, aspectRatio }) => {
  // Check if protein or calorie info is present for the 4th stat card
  let fourthStatLabel = 'CAL';
  let fourthStatValue = '—';

  if (recipe.proteinCallout) {
    fourthStatLabel = 'PROTEIN';
    const gMatch = recipe.proteinCallout.match(/(\d+)\s*g/i);
    if (gMatch) {
      fourthStatValue = `${gMatch[1]}g`;
    } else {
      const clean = recipe.proteinCallout.replace(/(?:of\s+)?protein/gi, '').trim();
      fourthStatValue = /^\d+$/.test(clean) ? `${clean}g` : (clean || '—');
    }
  } else if (recipe.calories) {
    fourthStatLabel = 'CAL';
    const calMatch = recipe.calories.match(/(\d+)/);
    fourthStatValue = calMatch ? `${calMatch[1]}` : recipe.calories.replace(/\s*cal/i, '').trim();
  }

  // Keep top left brand badge concise so it never crowds the right badge
  const rawTagline = recipe.taglineBadge || recipe.brandName.toUpperCase();
  const cleanTagline = rawTagline
    .replace(/^[\s•·\.\-]+/, '')
    .replace(/·\s*SKIP THE LIFE STORY/i, '')
    .trim() || recipe.brandName.toUpperCase();

  // Top right stat badge (e.g. 10 MIN · 4 SERVINGS)
  const cleanRightBadge = recipe.highlightBadge || `${recipe.cookTime || recipe.prepTime} · ${recipe.servings} SERVINGS`;
  const proxiedImage = getProxiedImageUrl(recipe.heroImage);
  const logoUrl = recipe.brandLogo ? getProxiedImageUrl(recipe.brandLogo) : null;

  return (
    <div
      className={`slide-container slide-1 aspect-${aspectRatio.replace(':', '-')}`}
      style={{
        '--accent-color': theme.accent,
        '--bg-dark': theme.bgDark,
        '--badge-bg': theme.badgeBg,
        '--badge-border': theme.badgeBorder,
        '--badge-text': theme.badgeText
      } as React.CSSProperties}
    >
      {/* Background Image with smooth dark gradient scrim */}
      <div
        className="slide-hero-bg"
        style={{
          backgroundImage: `url("${proxiedImage}")`
        }}
      >
        <div className="hero-gradient-overlay" />
      </div>

      {/* Top Header Bar */}
      <div className="slide-top-bar">
        <div className="brand-pill-badge">
          {logoUrl ? (
            <img src={logoUrl} alt={recipe.brandName} className="brand-pill-logo" crossOrigin="anonymous" />
          ) : (
            <span className="brand-pill-dot"></span>
          )}
          <span>{cleanTagline}</span>
        </div>

        <div className="hero-simple-badge">
          <span>{cleanRightBadge}</span>
        </div>
      </div>

      {/* Slide Safe-Zone Content - Centered in TikTok Viewport above lower caption */}
      <div className="slide-hero-safe-content">
        {/* Big Bold Headline Title */}
        <h1 className="hero-recipe-title">
          {recipe.title}
        </h1>

        {/* Hook Description Underneath Title */}
        <p className="hero-hook-text">
          {recipe.shortHook || `Better than takeout and ready in ${recipe.cookTime || recipe.prepTime}. ${recipe.ingredients.length} ingredients, ${recipe.method.length} steps.`}
        </p>

        {/* 4 Bottom Glassmorphic Macro Stat Cards */}
        <div className="hero-stats-grid">
          <div className="stat-box">
            <span className="stat-label">PREP</span>
            <span className="stat-value">{recipe.prepTime}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">COOK</span>
            <span className="stat-value">{recipe.cookTime}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">SERVES</span>
            <span className="stat-value">{recipe.servings}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">{fourthStatLabel}</span>
            <span className="stat-value">{fourthStatValue}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
