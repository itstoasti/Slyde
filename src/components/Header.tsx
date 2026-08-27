import React from 'react';
import { StudioViewMode, ThemeConfig } from '../types';
import { 
  Settings, 
  Download, 
  Layers, 
  Smartphone, 
  LayoutGrid, 
  Shuffle,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenExport: () => void;
  viewMode: StudioViewMode;
  onChangeViewMode: (mode: StudioViewMode) => void;
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

      {/* Center: View Switcher & Theme Shuffle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
