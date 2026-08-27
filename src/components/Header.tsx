import React from 'react';
import { StudioViewMode, ThemeConfig, AspectRatio } from '../types';
import { 
  Settings, 
  Download, 
  Layers, 
  Smartphone, 
  LayoutGrid, 
  Shuffle,
  PanelLeftClose,
  PanelLeft,
  Square
} from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenExport: () => void;
  viewMode: StudioViewMode;
  onChangeViewMode: (mode: StudioViewMode) => void;
  aspectRatio: AspectRatio;
  onChangeAspectRatio: (ratio: AspectRatio) => void;
  onRandomizeTheme: () => void;
  currentTheme: ThemeConfig;
  isLeftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenExport,
  viewMode,
  onChangeViewMode,
  aspectRatio,
  onChangeAspectRatio,
  onRandomizeTheme,
  currentTheme,
  isLeftPanelOpen,
  onToggleLeftPanel
}) => {
  return (
    <header className="app-header">
      {/* Left: Minimal Toggle & Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          className="btn-icon-square"
          onClick={onToggleLeftPanel}
          title={isLeftPanelOpen ? 'Hide Editor (Focus Mode)' : 'Show Editor'}
          style={{ width: 34, height: 34 }}
        >
          {isLeftPanelOpen ? (
            <PanelLeftClose size={17} />
          ) : (
            <PanelLeft size={17} color="var(--app-primary)" />
          )}
        </button>

        <div className="brand-logo-group">
          <div className="logo-mark">
            <Layers size={18} strokeWidth={2.5} />
          </div>
          <div className="brand-title-wrap">
            <div className="brand-title">Slyde</div>
          </div>
        </div>
      </div>

      {/* Center: View Switcher, Format Toggle & Theme Shuffle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Format / Aspect Ratio Toggle: TikTok (9:16) vs Instagram (1:1) */}
        <div className="toolbar-group" style={{ padding: '3px 4px' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px 0 6px' }}>
            Size
          </span>
          <button
            type="button"
            className={`toolbar-toggle-btn ${aspectRatio === '9:16' ? 'active' : ''}`}
            onClick={() => onChangeAspectRatio('9:16')}
            title="TikTok Vertical Video (9:16)"
          >
            <Smartphone size={13} />
            <span>9:16 TikTok</span>
          </button>
          <button
            type="button"
            className={`toolbar-toggle-btn ${aspectRatio === '1:1' ? 'active' : ''}`}
            onClick={() => onChangeAspectRatio('1:1')}
            title="Instagram Post Square (1:1)"
          >
            <Square size={13} />
            <span>1:1 Square</span>
          </button>
        </div>

        {/* View Mode: Phone vs Storyboard */}
        <div className="toolbar-group">
          <button
            type="button"
            className={`toolbar-toggle-btn ${viewMode === 'phone' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('phone')}
            title="Phone Preview"
          >
            <Smartphone size={14} />
            <span>Phone</span>
          </button>
          <button
            type="button"
            className={`toolbar-toggle-btn ${viewMode === 'storyboard' ? 'active' : ''}`}
            onClick={() => onChangeViewMode('storyboard')}
            title="Storyboard (All 3)"
          >
            <LayoutGrid size={14} />
            <span>Storyboard</span>
          </button>
        </div>

        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          onClick={onRandomizeTheme}
          title={`Theme: ${currentTheme.name}. Click to shuffle.`}
        >
          <Shuffle size={14} color={currentTheme.accent} />
          <span>{currentTheme.name}</span>
        </button>
      </div>

      {/* Right: Export & Settings */}
      <div className="header-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onOpenExport}
          title="Export Deck & AI Caption"
        >
          <Download size={15} />
          <span>Export</span>
        </button>

        <button
          type="button"
          className="btn-icon-square"
          onClick={onOpenSettings}
          title="Settings"
          style={{ width: 34, height: 34 }}
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
};
