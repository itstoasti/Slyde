import React, { useState } from 'react';
import { RecipeData, ThemeConfig, AspectRatio } from '../types';
import { Slide1Hero } from './slides/Slide1Hero';
import { Slide2RecipeCard } from './slides/Slide2RecipeCard';
import { Slide3CTA } from './slides/Slide3CTA';
import { downloadSlideAsPng, copySlideImageToClipboard } from '../utils/exporter';
import { Download, Copy, CheckCircle2, Edit3, ZoomIn, ZoomOut } from 'lucide-react';
import confetti from 'canvas-confetti';

interface StoryboardViewProps {
  recipe: RecipeData;
  theme: ThemeConfig;
  aspectRatio: AspectRatio;
  onEditSlide: (slideIndex: number) => void;
  slide1Ref: React.RefObject<HTMLDivElement>;
  slide2Ref: React.RefObject<HTMLDivElement>;
  slide3Ref: React.RefObject<HTMLDivElement>;
}

export const StoryboardView: React.FC<StoryboardViewProps> = ({
  recipe,
  theme,
  aspectRatio,
  onEditSlide,
  slide1Ref,
  slide2Ref,
  slide3Ref
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(0.72);

  const handleDownload = async (elementRef: React.RefObject<HTMLDivElement>, name: string) => {
    if (!elementRef.current) return;
    const slug = recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await downloadSlideAsPng(elementRef.current, `${slug}-${name}`);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
  };

  const handleCopy = async (elementRef: React.RefObject<HTMLDivElement>, index: number) => {
    if (!elementRef.current) return;
    const ok = await copySlideImageToClipboard(elementRef.current);
    if (ok) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2500);
    }
  };

  const slides = [
    { title: 'Slide 1: Hero & Hook', desc: 'Hero photo, hook teaser, macros', ref: slide1Ref, component: <Slide1Hero recipe={recipe} theme={theme} aspectRatio={aspectRatio} /> },
    { title: 'Slide 2: Recipe Card', desc: 'Adaptive ingredients & method', ref: slide2Ref, component: <Slide2RecipeCard recipe={recipe} theme={theme} aspectRatio={aspectRatio} /> },
    { title: 'Slide 3: Brand CTA', desc: '4 value props & website button', ref: slide3Ref, component: <Slide3CTA recipe={recipe} theme={theme} aspectRatio={aspectRatio} /> }
  ];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Zoom Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1080px', padding: '0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff' }}>3-Slide Storyboard Deck View</span>
          <span className="brand-badge-tag">Side-by-Side</span>
        </div>

        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-toggle-btn"
            onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.1))}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0 6px', color: 'var(--app-text-muted)' }}>
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            className="toolbar-toggle-btn"
            onClick={() => setZoomScale(prev => Math.min(1.0, prev + 0.1))}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* 3 Slides Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          width: '100%',
          maxWidth: '1200px',
          justifyContent: 'center'
        }}
      >
        {slides.map((s, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: '#121217',
              border: '1px solid var(--app-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
            }}
          >
            {/* Header controls for each slide */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>{s.title}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--app-text-dim)' }}>{s.desc}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                  onClick={() => onEditSlide(idx)}
                  title="Edit this slide in panel"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                  onClick={() => handleCopy(s.ref, idx)}
                  title="Copy to clipboard"
                >
                  {copiedIndex === idx ? <CheckCircle2 size={13} color="var(--app-success)" /> : <Copy size={13} />}
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ width: 28, height: 28, borderRadius: 6 }}
                  onClick={() => handleDownload(s.ref, `slide-${idx + 1}`)}
                  title="Download PNG"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>

            {/* Slide Frame Scaled */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                background: '#000000',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)'
              }}
            >
              <div
                style={{
                  width: '380px',
                  height: `${aspectRatio === '1:1' ? 380 : aspectRatio === '4:5' ? 475 : 675}px`,
                  transform: `scale(${zoomScale})`,
                  transformOrigin: 'top center',
                  margin: `0 0 ${(aspectRatio === '1:1' ? 380 : aspectRatio === '4:5' ? 475 : 675) * (zoomScale - 1)}px 0`
                }}
              >
                {s.component}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
