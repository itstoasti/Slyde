import React, { useState } from 'react';
import { RecipeData, ThemeConfig, AspectRatio } from '../types';
import { THEME_PRESETS } from '../data/presets';
import { 
  Sparkles, 
  UtensilsCrossed, 
  MousePointerClick, 
  Palette, 
  Plus, 
  Trash2,
  Upload,
  Smartphone,
  Square
} from 'lucide-react';

interface EditorPanelProps {
  recipe: RecipeData;
  theme: ThemeConfig;
  aspectRatio?: AspectRatio;
  onChangeAspectRatio?: (ratio: AspectRatio) => void;
  onUpdateRecipe: (updated: RecipeData) => void;
  onUpdateTheme: (theme: ThemeConfig) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  recipe,
  theme,
  aspectRatio = '9:16',
  onChangeAspectRatio,
  onUpdateRecipe,
  onUpdateTheme
}) => {
  const [activeTab, setActiveTab] = useState<'slide1' | 'slide2' | 'slide3' | 'style'>('slide2');

  const handleFieldChange = (field: keyof RecipeData, value: any) => {
    onUpdateRecipe({
      ...recipe,
      [field]: value
    });
  };

  // Ingredient list handlers
  const handleIngredientChange = (index: number, key: 'name' | 'amount', val: string) => {
    const updated = [...recipe.ingredients];
    updated[index] = { ...updated[index], [key]: val };
    handleFieldChange('ingredients', updated);
  };

  const handleAddIngredient = () => {
    const updated = [...recipe.ingredients, { name: 'New Ingredient', amount: '1 portion' }];
    handleFieldChange('ingredients', updated);
  };

  const handleRemoveIngredient = (index: number) => {
    const updated = recipe.ingredients.filter((_, i) => i !== index);
    handleFieldChange('ingredients', updated);
  };

  // Method step handlers
  const handleMethodChange = (index: number, val: string) => {
    const updated = [...recipe.method];
    updated[index] = val;
    handleFieldChange('method', updated);
  };

  const handleAddMethodStep = () => {
    const updated = [...recipe.method, 'Describe cooking instruction step...'];
    handleFieldChange('method', updated);
  };

  const handleRemoveMethodStep = (index: number) => {
    const updated = recipe.method.filter((_, i) => i !== index);
    handleFieldChange('method', updated);
  };

  // Perk handlers
  const handlePerkChange = (index: number, key: 'title' | 'desc', val: string) => {
    const updated = [...recipe.perks];
    updated[index] = { ...updated[index], [key]: val };
    handleFieldChange('perks', updated);
  };

  // Custom Image Upload handler
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleFieldChange('heroImage', event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Custom Logo Upload handler
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleFieldChange('brandLogo', event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="editor-panel-container">
      {/* Navigation Tabs */}
      <div className="editor-nav-tabs">
        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'slide1' ? 'active' : ''}`}
          onClick={() => setActiveTab('slide1')}
        >
          <Sparkles size={15} />
          <span>Slide 1: Hero</span>
          <span className="tab-badge-num">1</span>
        </button>

        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'slide2' ? 'active' : ''}`}
          onClick={() => setActiveTab('slide2')}
        >
          <UtensilsCrossed size={15} />
          <span>Slide 2: Recipe Card</span>
          <span className="tab-badge-num">2</span>
        </button>

        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'slide3' ? 'active' : ''}`}
          onClick={() => setActiveTab('slide3')}
        >
          <MousePointerClick size={15} />
          <span>Slide 3: CTA</span>
          <span className="tab-badge-num">3</span>
        </button>

        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          <Palette size={15} />
          <span>Style & Theme</span>
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="editor-form-scroll">
        {/* ================= Slide 1 Controls ================= */}
        {activeTab === 'slide1' && (
          <>
            <div className="form-group">
              <label className="form-label">Recipe Title (Hero Headline)</label>
              <input
                type="text"
                className="form-input"
                value={recipe.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hook Teaser (Opening Line)</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={recipe.shortHook}
                onChange={(e) => handleFieldChange('shortHook', e.target.value)}
                placeholder="e.g. No oven, no stove — 5 minutes and it's done. Peak summer."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Top Tagline Pill</label>
              <input
                type="text"
                className="form-input"
                value={recipe.taglineBadge}
                onChange={(e) => handleFieldChange('taglineBadge', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Hero Food Photo</span>
                <label className="upload-inline-link" style={{ cursor: 'pointer', color: 'var(--app-primary)', fontSize: '0.75rem' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFileUpload} />
                  + Upload Image
                </label>
              </label>
              <div className="item-dynamic-row">
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={recipe.heroImage}
                  onChange={(e) => handleFieldChange('heroImage', e.target.value)}
                  placeholder="https://image-url..."
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Top Stat Highlight</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipe.proteinCallout || ''}
                  onChange={(e) => handleFieldChange('proteinCallout', e.target.value)}
                  placeholder="e.g. 88g of protein"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Stat Sub-badge</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipe.highlightBadge || ''}
                  onChange={(e) => handleFieldChange('highlightBadge', e.target.value)}
                  placeholder="e.g. 10 MIN · 8 SERVINGS"
                />
              </div>
            </div>

            <div className="form-grid-4">
              <div className="form-group">
                <label className="form-label">Prep</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipe.prepTime}
                  onChange={(e) => handleFieldChange('prepTime', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cook</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipe.cookTime}
                  onChange={(e) => handleFieldChange('cookTime', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Serves</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipe.servings}
                  onChange={(e) => handleFieldChange('servings', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Calories</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipe.calories}
                  onChange={(e) => handleFieldChange('calories', e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* ================= Slide 2 Controls ================= */}
        {activeTab === 'slide2' && (
          <>
            {/* Ingredients List Editor */}
            <div className="form-group">
              <label className="form-label">
                <span>Ingredients ({recipe.ingredients.length})</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--app-text-dim)' }}>Name — Amount</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recipe.ingredients.map((ing, idx) => (
                  <div key={idx} className="item-dynamic-row">
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1.6 }}
                      value={ing.name}
                      placeholder="Ingredient name"
                      onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={ing.amount}
                      placeholder="Amount"
                      onChange={(e) => handleIngredientChange(idx, 'amount', e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-remove-item"
                      onClick={() => handleRemoveIngredient(idx)}
                      title="Remove ingredient"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-add-item"
                  onClick={handleAddIngredient}
                >
                  <Plus size={15} /> Add Ingredient
                </button>
              </div>
            </div>

            {/* Method Steps Editor */}
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">
                <span>Method / Instructions ({recipe.method.length} steps)</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recipe.method.map((step, idx) => (
                  <div key={idx} className="item-dynamic-row">
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--app-primary)', width: 18 }}>
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={step}
                      placeholder="Cooking instruction step..."
                      onChange={(e) => handleMethodChange(idx, e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-remove-item"
                      onClick={() => handleRemoveMethodStep(idx)}
                      title="Remove step"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-add-item"
                  onClick={handleAddMethodStep}
                >
                  <Plus size={15} /> Add Method Step
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= Slide 3 Controls ================= */}
        {activeTab === 'slide3' && (
          <>
            {/* App Icon / Logo Section */}
            <div className="form-group" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--app-border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  <span>App Icon / Brand Logo</span>
                </label>
                {recipe.brandLogo && (
                  <button
                    type="button"
                    onClick={() => handleFieldChange('brandLogo', '')}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  >
                    Remove Logo
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 52, height: 52, borderRadius: 13, overflow: 'hidden', border: '2px solid rgba(255, 255, 255, 0.15)', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                  {recipe.brandLogo ? (
                    <img src={recipe.brandLogo} alt="App Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '0.62rem', color: 'var(--app-text-muted)', textAlign: 'center', padding: 2 }}>No Logo</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700 }}>
                    <Upload size={13} />
                    <span>Upload Logo Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleLogoFileUpload}
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => handleFieldChange('brandLogo', '/snaprecipes-app-icon.png')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--app-primary)', fontSize: '0.70rem', cursor: 'pointer', textAlign: 'left', fontWeight: 600, padding: 0 }}
                  >
                    ✦ Use SnapRecipes App Icon
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--app-text-muted)', fontWeight: 600 }}>Or Image URL:</span>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.75rem', padding: '6px 8px' }}
                  placeholder="https://.../logo.png"
                  value={recipe.brandLogo || ''}
                  onChange={(e) => handleFieldChange('brandLogo', e.target.value)}
                />
              </div>

              {/* Logo Size Adjuster */}
              {recipe.brandLogo && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.70rem', color: 'var(--app-text-muted)', fontWeight: 700 }}>
                      Logo Icon Size:
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--app-primary)', fontWeight: 800 }}>
                      {recipe.brandLogoSize || 58}px
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="range"
                      min={32}
                      max={96}
                      step={2}
                      value={recipe.brandLogoSize || 58}
                      onChange={(e) => handleFieldChange('brandLogoSize', Number(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--app-primary)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[44, 58, 74].map(sz => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => handleFieldChange('brandLogoSize', sz)}
                          style={{
                            padding: '2px 7px',
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            borderRadius: 4,
                            border: (recipe.brandLogoSize || 58) === sz ? '1px solid var(--app-primary)' : '1px solid var(--app-border)',
                            background: (recipe.brandLogoSize || 58) === sz ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.04)',
                            color: (recipe.brandLogoSize || 58) === sz ? '#ffffff' : 'var(--app-text-muted)',
                            cursor: 'pointer'
                          }}
                        >
                          {sz === 44 ? 'S' : sz === 58 ? 'M' : 'L'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Brand Name (Large Headline)</label>
              <input
                type="text"
                className="form-input"
                value={recipe.brandName}
                onChange={(e) => handleFieldChange('brandName', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Brand Subtitle / Value Prop</label>
              <input
                type="text"
                className="form-input"
                value={recipe.brandSubtitle}
                onChange={(e) => handleFieldChange('brandSubtitle', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Top Banner Pill</label>
              <input
                type="text"
                className="form-input"
                value={recipe.brandPillBadge}
                onChange={(e) => handleFieldChange('brandPillBadge', e.target.value)}
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">CTA Button Label</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipe.ctaButtonText}
                  onChange={(e) => handleFieldChange('ctaButtonText', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Website / Target Link</label>
                <input
                  type="text"
                  className="form-input"
                  value={recipe.ctaUrl}
                  onChange={(e) => handleFieldChange('ctaUrl', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Social Media Handle</label>
              <input
                type="text"
                className="form-input"
                value={recipe.socialHandle}
                onChange={(e) => handleFieldChange('socialHandle', e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">4 Key Value Props / Feature Cards</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recipe.perks.map((perk, idx) => (
                  <div key={perk.id} style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={perk.title}
                      placeholder="Title"
                      onChange={(e) => handlePerkChange(idx, 'title', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1.5 }}
                      value={perk.desc}
                      placeholder="Description"
                      onChange={(e) => handlePerkChange(idx, 'desc', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ================= Theme & Style Controls ================= */}
        {activeTab === 'style' && (
          <>
            {/* Image Size & Aspect Ratio Format Selector */}
            {onChangeAspectRatio && (
              <div className="form-group" style={{ marginBottom: 18 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Image Size & Format</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--app-primary)', fontWeight: 800 }}>
                    {aspectRatio === '1:1' ? '1:1 Square (1080x1080)' : '9:16 Vertical (1080x1920)'}
                  </span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div
                    className={`theme-card-option ${aspectRatio === '9:16' ? 'active' : ''}`}
                    onClick={() => onChangeAspectRatio('9:16')}
                    style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Smartphone size={16} color={aspectRatio === '9:16' ? 'var(--app-primary)' : 'var(--app-text-muted)'} />
                      <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#ffffff' }}>9:16 Vertical</span>
                    </div>
                    <span style={{ fontSize: '0.70rem', color: 'var(--app-text-dim)' }}>TikTok · Reels · Stories (1080x1920)</span>
                  </div>

                  <div
                    className={`theme-card-option ${aspectRatio === '1:1' ? 'active' : ''}`}
                    onClick={() => onChangeAspectRatio('1:1')}
                    style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Square size={16} color={aspectRatio === '1:1' ? 'var(--app-primary)' : 'var(--app-text-muted)'} />
                      <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#ffffff' }}>1:1 Square</span>
                    </div>
                    <span style={{ fontSize: '0.70rem', color: 'var(--app-text-dim)' }}>Instagram Feed Post (1080x1080)</span>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Color Themes & Visual Palettes</label>
              <div className="theme-selector-grid">
                {Object.values(THEME_PRESETS).map((t) => (
                  <div
                    key={t.id}
                    className={`theme-card-option ${theme.id === t.id ? 'active' : ''}`}
                    onClick={() => onUpdateTheme(t)}
                  >
                    <div className="theme-swatches">
                      <div className="theme-dot" style={{ background: t.accent }} />
                      <div className="theme-dot" style={{ background: t.bgDark }} />
                      <div className="theme-dot" style={{ background: t.bgCard }} />
                    </div>
                    <span className="theme-name">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
