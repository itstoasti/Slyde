import React, { useState, useEffect } from 'react';
import { RecipeData, ThemeConfig, AspectRatio } from '../types';
import { Slide1Hero } from './slides/Slide1Hero';
import { Slide2RecipeCard } from './slides/Slide2RecipeCard';
import { Slide3CTA } from './slides/Slide3CTA';
import { getProxiedImageUrl } from '../utils/imageProxy';
import { 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  Music2, 
  Play, 
  Pause, 
  Eye, 
  EyeOff,
  ZoomIn, 
  ZoomOut, 
  ArrowLeft, 
  Search, 
  Repeat2, 
  Image as ImageIcon, 
  Smile, 
  AtSign,
  MoreHorizontal,
  Send,
  Home,
  PlusSquare,
  Compass,
  Wifi,
  Battery
} from 'lucide-react';

interface PhoneSimulatorProps {
  recipe: RecipeData;
  theme: ThemeConfig;
  aspectRatio: AspectRatio;
  currentSlide: number;
  onSlideChange: (slideIdx: number) => void;
  // Ref handles for export capturing
  slide1Ref: React.RefObject<HTMLDivElement>;
  slide2Ref: React.RefObject<HTMLDivElement>;
  slide3Ref: React.RefObject<HTMLDivElement>;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({
  recipe,
  theme,
  aspectRatio,
  currentSlide,
  onSlideChange,
  slide1Ref,
  slide2Ref,
  slide3Ref
}) => {
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  // Zoom scale state with localStorage persistence & responsive default
  const [zoomScale, setZoomScale] = useState<number>(() => {
    const saved = localStorage.getItem('slyde_phone_zoom');
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= 0.5 && val <= 1.4) return val;
    }
    if (typeof window !== 'undefined' && window.innerHeight < 920) {
      return 0.82;
    }
    return 1.0;
  });

  const handleZoomChange = (newScale: number) => {
    const clamped = Math.min(1.3, Math.max(0.5, Math.round(newScale * 100) / 100));
    setZoomScale(clamped);
    localStorage.setItem('slyde_phone_zoom', clamped.toString());
  };

  // Auto-play preview timer
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        onSlideChange((currentSlide + 1) % 3);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSlide, onSlideChange]);

  // Keyboard navigation (Left / Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onSlideChange((currentSlide - 1 + 3) % 3);
      } else if (e.key === 'ArrowRight') {
        onSlideChange((currentSlide + 1) % 3);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, onSlideChange]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 40) {
      onSlideChange((currentSlide + 1) % 3);
    } else if (diff < -40) {
      onSlideChange((currentSlide - 1 + 3) % 3);
    }
    setTouchStart(null);
  };

  const phoneHeight = 675;
  const exportSlideHeight = aspectRatio === '1:1' ? 360 : aspectRatio === '4:5' ? 450 : 640;
  const logoUrl = recipe.brandLogo ? getProxiedImageUrl(recipe.brandLogo) : null;
  const brandUsername = (recipe.brandName || 'snaprecipes').toLowerCase().replace(/[^a-z0-9_]/g, '_');

  return (
    <div className="phone-simulator-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Top Simulator Controls Toolbar */}
      <div className="simulator-top-toolbar">
        {/* Social Overlay Toggle (On / Off) */}
        <div className="toolbar-group">
          <button
            type="button"
            className={`toolbar-toggle-btn ${showOverlay ? 'active' : ''}`}
            onClick={() => setShowOverlay(prev => !prev)}
            title={showOverlay ? 'Hide Social UI Overlay' : 'Show Social UI Overlay'}
          >
            {showOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>
              {showOverlay 
                ? (aspectRatio === '1:1' ? 'Instagram UI' : 'TikTok UI') 
                : 'Clean'}
            </span>
          </button>
        </div>

        {/* Auto Play Slideshow preview button */}
        <div className="toolbar-group">
          <button
            type="button"
            className={`toolbar-toggle-btn ${isPlaying ? 'active' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
          </button>
        </div>

        {/* Interactive View Zoom In / Out & Fit Controls */}
        <div className="toolbar-group" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            className="toolbar-toggle-btn"
            onClick={() => handleZoomChange(zoomScale - 0.08)}
            title="Zoom Out (Make phone smaller to fit screen)"
            style={{ padding: '4px 6px' }}
          >
            <ZoomOut size={13} />
          </button>

          <span 
            style={{ 
              fontSize: '0.72rem', 
              fontWeight: 800, 
              color: 'var(--app-primary)', 
              minWidth: 36, 
              textAlign: 'center',
              cursor: 'pointer' 
            }}
            onClick={() => handleZoomChange(zoomScale === 1.0 ? 0.82 : 1.0)}
            title="Click to toggle Fit / 100%"
          >
            {Math.round(zoomScale * 100)}%
          </span>

          <button
            type="button"
            className="toolbar-toggle-btn"
            onClick={() => handleZoomChange(zoomScale + 0.08)}
            title="Zoom In"
            style={{ padding: '4px 6px' }}
          >
            <ZoomIn size={13} />
          </button>

          {/* Quick Fit Presets */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
            <button
              type="button"
              className={`toolbar-toggle-btn ${zoomScale <= 0.84 ? 'active' : ''}`}
              onClick={() => handleZoomChange(0.80)}
              style={{ padding: '3px 6px', fontSize: '0.68rem', fontWeight: 700 }}
              title="Fit cleanly on laptop screen"
            >
              Fit
            </button>
            <button
              type="button"
              className={`toolbar-toggle-btn ${zoomScale >= 0.98 && zoomScale <= 1.02 ? 'active' : ''}`}
              onClick={() => handleZoomChange(1.0)}
              style={{ padding: '3px 6px', fontSize: '0.68rem', fontWeight: 700 }}
              title="Actual 100% Size"
            >
              100%
            </button>
          </div>
        </div>
      </div>

      {/* Scalable Phone Viewport Container */}
      <div
        className="phone-zoom-viewport"
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: 'top center',
          transition: 'transform 0.15s ease-out',
          marginBottom: `${(phoneHeight * zoomScale) - phoneHeight}px`
        }}
      >
        {/* Main Phone Device Mockup Frame — Always Full Realistic Smartphone */}
        <div className="phone-device-container">
          {/* Dynamic Island / Top Notch */}
          <div className="phone-island">
            <div className="island-camera" />
            <div className="island-sensor" />
          </div>

          {/* Phone Screen Container */}
          <div 
            className="phone-screen"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* =========================================================
                1:1 ASPECT RATIO (INSTAGRAM POST FEED VIEW)
                ========================================================= */}
            {aspectRatio === '1:1' ? (
              showOverlay ? (
                <div className="instagram-post-container">
                  {/* Status Bar */}
                  <div className="instagram-status-bar">
                    <span>9:41</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Wifi size={12} />
                      <Battery size={13} />
                    </div>
                  </div>

                  {/* Instagram Post Header */}
                  <div className="instagram-post-header">
                    <div className="instagram-user-left">
                      <div className="instagram-avatar-ring">
                        <div className="instagram-avatar-inner">
                          {logoUrl ? (
                            <img src={logoUrl} alt="" crossOrigin="anonymous" />
                          ) : (
                            (recipe.brandName || 'S').charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>
                      <div className="instagram-user-meta">
                        <div className="instagram-username">
                          {brandUsername}
                        </div>
                        <div className="instagram-subtext">Original recipe · Sponsored</div>
                      </div>
                    </div>
                    <div style={{ cursor: 'pointer', padding: 4 }}>
                      <MoreHorizontal size={18} color="#ffffff" />
                    </div>
                  </div>

                  {/* Square Carousel Media Canvas (360x360) */}
                  <div className="instagram-media-canvas">
                    {/* Top Right Carousel Counter Pill (1/3) */}
                    <div className="instagram-counter-badge">
                      {currentSlide + 1}/3
                    </div>

                    {/* Prev / Next Navigation Arrows */}
                    <button
                      type="button"
                      className="phone-nav-arrow left"
                      onClick={() => onSlideChange((currentSlide - 1 + 3) % 3)}
                      aria-label="Previous slide"
                    >
                      <ChevronLeft size={22} />
                    </button>

                    <button
                      type="button"
                      className="phone-nav-arrow right"
                      onClick={() => onSlideChange((currentSlide + 1) % 3)}
                      aria-label="Next slide"
                    >
                      <ChevronRight size={22} />
                    </button>

                    {/* Active Square Slide */}
                    <div style={{ width: '100%', height: '100%' }}>
                      {currentSlide === 0 && (
                        <Slide1Hero recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                      )}
                      {currentSlide === 1 && (
                        <Slide2RecipeCard recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                      )}
                      {currentSlide === 2 && (
                        <Slide3CTA recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                      )}
                    </div>
                  </div>

                  {/* Instagram Action Bar */}
                  <div className="instagram-action-bar">
                    <div className="instagram-action-left">
                      <Heart size={21} className="instagram-action-icon" />
                      <MessageCircle size={21} className="instagram-action-icon" />
                      <Send size={19} className="instagram-action-icon" style={{ transform: 'rotate(15deg)' }} />
                    </div>

                    {/* 3 Pagination Dots */}
                    <div className="instagram-carousel-dots-wrap">
                      {[0, 1, 2].map((idx) => (
                        <span
                          key={idx}
                          className={`instagram-dot ${currentSlide === idx ? 'active' : ''}`}
                          onClick={() => onSlideChange(idx)}
                        />
                      ))}
                    </div>

                    <div>
                      <Bookmark size={21} className="instagram-action-icon" />
                    </div>
                  </div>

                  {/* Instagram Post Caption & Meta */}
                  <div className="instagram-post-details">
                    <div className="instagram-likes-row">1,842 likes</div>
                    <div className="instagram-caption-row">
                      <span className="instagram-caption-user">{brandUsername}</span>
                      <span>{recipe.title} — {recipe.shortHook || 'Save this recipe for dinner!'}</span>
                    </div>
                    <div className="instagram-comments-link">View all 38 comments</div>
                    <div className="instagram-timestamp">30 minutes ago</div>
                  </div>

                  {/* Instagram Bottom Navigation & Home Indicator */}
                  <div className="instagram-bottom-nav">
                    <Home size={19} color="#ffffff" style={{ cursor: 'pointer' }} />
                    <Search size={19} color="#ffffff" style={{ cursor: 'pointer' }} />
                    <PlusSquare size={19} color="#ffffff" style={{ cursor: 'pointer' }} />
                    <Compass size={19} color="#ffffff" style={{ cursor: 'pointer' }} />
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3f3f46', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', border: '1px solid #71717a' }}>
                      {(recipe.brandName || 'S').charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="instagram-home-indicator" />
                </div>
              ) : (
                /* Clean Centered 1:1 View */
                <div className="instagram-clean-centered-view">
                  <div className="phone-slide-indicators" style={{ top: 12 }}>
                    {[0, 1, 2].map((idx) => (
                      <div
                        key={idx}
                        className={`slide-indicator-bar ${currentSlide === idx ? 'active' : ''}`}
                        onClick={() => onSlideChange(idx)}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    className="phone-nav-arrow left"
                    onClick={() => onSlideChange((currentSlide - 1 + 3) % 3)}
                    aria-label="Previous slide"
                  >
                    <ChevronLeft size={22} />
                  </button>

                  <button
                    type="button"
                    className="phone-nav-arrow right"
                    onClick={() => onSlideChange((currentSlide + 1) % 3)}
                    aria-label="Next slide"
                  >
                    <ChevronRight size={22} />
                  </button>

                  <div style={{ width: 360, height: 360 }}>
                    {currentSlide === 0 && (
                      <Slide1Hero recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                    )}
                    {currentSlide === 1 && (
                      <Slide2RecipeCard recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                    )}
                    {currentSlide === 2 && (
                      <Slide3CTA recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                    )}
                  </div>
                </div>
              )
            ) : (
              /* =========================================================
                  9:16 ASPECT RATIO (TIKTOK VERTICAL VIEW)
                  ========================================================= */
              <>
                {/* Top Slide Indicator Bars (when overlay is off) */}
                {!showOverlay && (
                  <div className="phone-slide-indicators">
                    {[0, 1, 2].map((idx) => (
                      <div
                        key={idx}
                        className={`slide-indicator-bar ${currentSlide === idx ? 'active' : ''}`}
                        onClick={() => onSlideChange(idx)}
                      />
                    ))}
                  </div>
                )}

                {/* Prev / Next Navigation Arrows on hover */}
                <button
                  type="button"
                  className="phone-nav-arrow left"
                  onClick={() => onSlideChange((currentSlide - 1 + 3) % 3)}
                  aria-label="Previous slide"
                >
                  <ChevronLeft size={22} />
                </button>

                <button
                  type="button"
                  className="phone-nav-arrow right"
                  onClick={() => onSlideChange((currentSlide + 1) % 3)}
                  aria-label="Next slide"
                >
                  <ChevronRight size={22} />
                </button>

                {/* Active Slide View */}
                <div style={{ width: '100%', height: '100%' }}>
                  {currentSlide === 0 && (
                    <Slide1Hero recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                  )}
                  {currentSlide === 1 && (
                    <Slide2RecipeCard recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                  )}
                  {currentSlide === 2 && (
                    <Slide3CTA recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
                  )}
                </div>

                {/* Exact 1:1 Pixel-Accurate TikTok UI Overlay */}
                {showOverlay && (
                  <div className="tiktok-real-overlay">
                    {/* 1. Top Header: Back button & Search pill */}
                    <div className="tiktok-top-bar">
                      <div className="tiktok-back-btn">
                        <ArrowLeft size={19} color="#ffffff" strokeWidth={2.5} />
                      </div>
                      <div className="tiktok-search-pill">
                        <div className="tiktok-search-left">
                          <Search size={13} color="#e2e8f0" strokeWidth={2.4} />
                          <span className="tiktok-search-title">Find related content</span>
                        </div>
                        <span className="tiktok-search-divider">|</span>
                        <span className="tiktok-search-btn">Search</span>
                      </div>
                    </div>

                    {/* 2. Right Action Sidebar */}
                    <div className="tiktok-right-sidebar">
                      <div className="tiktok-avatar-wrap">
                        <div className="tiktok-avatar-img">
                          {logoUrl ? (
                            <img src={logoUrl} alt="" crossOrigin="anonymous" />
                          ) : (
                            recipe.brandName.charAt(0)
                          )}
                        </div>
                        <div className="tiktok-avatar-plus">+</div>
                      </div>

                      <div className="tiktok-action-item">
                        <Heart size={25} fill="#ffffff" stroke="none" />
                        <span className="tiktok-action-count">0</span>
                      </div>

                      <div className="tiktok-action-item">
                        <MessageCircle size={25} fill="#ffffff" stroke="none" />
                        <span className="tiktok-action-count">Add 1st</span>
                      </div>

                      <div className="tiktok-action-item">
                        <Bookmark size={25} fill="#ffffff" stroke="none" />
                        <span className="tiktok-action-count">0</span>
                      </div>

                      <div className="tiktok-action-item">
                        <Share2 size={25} fill="#ffffff" stroke="none" />
                        <span className="tiktok-action-count">Share</span>
                      </div>

                      <div className="tiktok-sound-disc">
                        <Music2 size={15} color="#ffffff" />
                      </div>
                    </div>

                    {/* 3. Bottom Carousel Dots, Repost Pill, Caption & Comment Bar */}
                    <div className="tiktok-bottom-overlay">
                      {/* 3 Carousel Dots with Active Slide Highlight */}
                      <div className="tiktok-carousel-dots">
                        {[0, 1, 2].map((idx) => (
                          <span
                            key={idx}
                            className={`tiktok-dot ${currentSlide === idx ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSlideChange(idx);
                            }}
                          />
                        ))}
                      </div>

                      {/* Repost to followers button */}
                      <div className="tiktok-repost-pill">
                        <Repeat2 size={13} color="#ffffff" strokeWidth={2.4} />
                        <span>Repost to followers</span>
                      </div>

                      {/* Account Name & Photo Tag */}
                      <div className="tiktok-account-row">
                        <span className="tiktok-account-name">{recipe.brandName || 'Snap Recipes'}</span>
                        <span className="tiktok-photo-badge">
                          <ImageIcon size={10} style={{ marginRight: 2 }} />
                          Photo
                        </span>
                        <span className="tiktok-timestamp">· 40m ago</span>
                      </div>

                      {/* Post Title */}
                      <div className="tiktok-post-title">
                        {recipe.title.toUpperCase()}
                      </div>

                      {/* Multi-line Caption Snippet with ...more */}
                      <div className="tiktok-caption-snippet">
                        {recipe.title.toUpperCase()} — {recipe.shortHook || 'Rich, satisfying, and effortless. Restaurant-quality flavors made right at home.'} {recipe.ingredients.length} ingredients, {recipe.method.length} steps. 🍽️ What you need: {recipe.ingredients.slice(0, 2).map(i => `${i.amount ? i.amount + ' ' : ''}${i.name}`).join(', ')}...<span className="tiktok-more-btn">more</span>
                      </div>

                      {/* Sound Track Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ffffff', fontSize: '0.64rem', fontWeight: 600, opacity: 0.9 }}>
                        <Music2 size={11} color="#ffffff" />
                        <span>Contains: Viral Recipe Audio · Original</span>
                      </div>

                      {/* Bottom Add Comment Bar */}
                      <div className="tiktok-comment-bar">
                        <div className="tiktok-input-placeholder">Add comment...</div>
                        <div className="tiktok-input-icons">
                          <ImageIcon size={16} color="#9ca3af" />
                          <Smile size={16} color="#9ca3af" />
                          <AtSign size={16} color="#9ca3af" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Slide Thumbnails & Bottom Selector */}
      <div className="simulator-bottom-bar" style={{ marginTop: 14 }}>
        <button
          type="button"
          className={`slide-thumb-btn ${currentSlide === 0 ? 'active' : ''}`}
          onClick={() => onSlideChange(0)}
        >
          <div className="thumb-preview-mini">1</div>
          <span>Slide 1: Hook</span>
        </button>

        <button
          type="button"
          className={`slide-thumb-btn ${currentSlide === 1 ? 'active' : ''}`}
          onClick={() => onSlideChange(1)}
        >
          <div className="thumb-preview-mini">2</div>
          <span>Slide 2: Card</span>
        </button>

        <button
          type="button"
          className={`slide-thumb-btn ${currentSlide === 2 ? 'active' : ''}`}
          onClick={() => onSlideChange(2)}
        >
          <div className="thumb-preview-mini">3</div>
          <span>Slide 3: CTA</span>
        </button>
      </div>

      {/* Off-screen export stage with full DOM nodes for all 3 slides for instant high-res capture */}
      <div
        className="export-offscreen-stage"
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          pointerEvents: 'none',
          zIndex: -999,
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}
        aria-hidden="true"
      >
        <div ref={slide1Ref} style={{ width: 360, height: exportSlideHeight, overflow: 'hidden', position: 'relative' }}>
          <Slide1Hero recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
        </div>
        <div ref={slide2Ref} style={{ width: 360, height: exportSlideHeight, overflow: 'hidden', position: 'relative' }}>
          <Slide2RecipeCard recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
        </div>
        <div ref={slide3Ref} style={{ width: 360, height: exportSlideHeight, overflow: 'hidden', position: 'relative' }}>
          <Slide3CTA recipe={recipe} theme={theme} aspectRatio={aspectRatio} />
        </div>
      </div>
    </div>
  );
};
