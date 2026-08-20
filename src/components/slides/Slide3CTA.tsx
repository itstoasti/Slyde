import React from 'react';
import { RecipeData, ThemeConfig, AspectRatio } from '../../types';
import { getProxiedImageUrl } from '../../utils/imageProxy';

interface Slide3CTAProps {
  recipe: RecipeData;
  theme: ThemeConfig;
  aspectRatio: AspectRatio;
}

export const Slide3CTA: React.FC<Slide3CTAProps> = ({ recipe, theme, aspectRatio }) => {
  const logoUrl = recipe.brandLogo ? getProxiedImageUrl(recipe.brandLogo) : null;
  const logoSize = recipe.brandLogoSize || 52;
  const logoRadius = Math.max(8, Math.round(logoSize * 0.26));

  return (
    <div
      className={`slide-container slide-3 aspect-${aspectRatio.replace(':', '-')}`}
      style={{
        '--accent-color': theme.accent,
        '--bg-dark': theme.bgDark,
        '--button-bg': theme.buttonBg,
        '--button-text': theme.buttonText,
        '--button-glow': theme.buttonGlow,
        '--pill-num-bg': theme.pillNumberBg,
        '--pill-num-text': theme.pillNumberText
      } as React.CSSProperties}
    >
      {/* Background ambient lighting */}
      <div className="cta-ambient-orb" />

      <div className="cta-content-wrapper">
        {/* Top Feature Pill */}
        <div className="cta-top-badge">
          <span>{recipe.brandPillBadge || 'AD-FREE · NO BLOG RANTS · JUST RECIPES'}</span>
        </div>

        {/* Brand Headline with App Icon Logo */}
        <div className="cta-brand-header">
          {logoUrl && (
            <div 
              className="cta-app-logo-box"
              style={{
                width: `${logoSize}px`,
                height: `${logoSize}px`,
                borderRadius: `${logoRadius}px`
              }}
            >
              <img
                src={logoUrl}
                alt={recipe.brandName}
                className="cta-app-logo-img"
                crossOrigin="anonymous"
              />
            </div>
          )}
          <h1 className="cta-brand-title">{recipe.brandName}</h1>
          <p className="cta-brand-subtitle">{recipe.brandSubtitle || 'Save any recipe in one tap.'}</p>
        </div>

        {/* 4 Feature Cards Grid */}
        <div className="cta-perks-grid">
          {recipe.perks.map((perk) => (
            <div key={perk.id} className="cta-perk-card">
              <div className="perk-number">{perk.id}</div>
              <div className="perk-info">
                <h4 className="perk-title">{perk.title}</h4>
                <p className="perk-desc">{perk.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Brand Name Indicator Pill */}
        <div className="brand-mini-pill">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="brand-mini-logo-icon"
              crossOrigin="anonymous"
            />
          ) : (
            <span className="brand-square-icon"></span>
          )}
          <span className="brand-pill-label">{recipe.brandName}</span>
        </div>

        {/* Glowing Action Button */}
        <div className="cta-button-container">
          <button className="cta-glow-button" type="button">
            {recipe.ctaButtonText || 'Get the app — free'}
          </button>
        </div>

        {/* Clean Website Domain / CTA Link */}
        {recipe.ctaUrl && (
          <div className="cta-footer-links" style={{ justifyContent: 'center' }}>
            <span>{recipe.ctaUrl}</span>
          </div>
        )}
      </div>
    </div>
  );
};
