import React, { useState } from 'react';
import { TelegramConfig, RecipeData } from '../types';
import { 
  X, 
  Bot, 
  Terminal, 
  Play, 
  Radio,
  Sparkles
} from 'lucide-react';
import { extractRecipeFromUrl } from '../utils/recipeExtractor';

interface BotHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramConfig: TelegramConfig;
  onOpenSettings: () => void;
  onTestUrl: (recipe: RecipeData) => void;
}

export const BotHubModal: React.FC<BotHubModalProps> = ({
  isOpen,
  onClose,
  telegramConfig,
  onOpenSettings,
  onTestUrl
}) => {
  const [testUrlInput, setTestUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusLog, setStatusLog] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfigured = Boolean(telegramConfig.botToken);

  const handleSimulateUrl = async () => {
    if (!testUrlInput.trim()) return;
    setIsProcessing(true);
    setStatusLog('🤖 Simulating Telegram message receipt: Extracting recipe...');

    try {
      const extracted = await extractRecipeFromUrl(testUrlInput.trim());
      onTestUrl(extracted);
      setStatusLog(`✅ Extracted "${extracted.title}"! Slides created in studio.`);
    } catch (e: any) {
      setStatusLog(`⚠️ Simulation Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Bot size={22} color="#38bdf8" />
            <span>24/7 Telegram Bot Automation Hub</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status Hero Card */}
          <div
            style={{
              background: isConfigured
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.25))'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(120, 53, 15, 0.25))',
              border: `1.5px solid ${isConfigured ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
              borderRadius: 'var(--radius-md)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: isConfigured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Radio size={22} color={isConfigured ? '#10b981' : '#f59e0b'} className={isConfigured ? 'animate-pulse' : ''} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{isConfigured ? '24/7 Bot Service Active' : 'Bot Setup Required'}</span>
                  {isConfigured && <span className="brand-badge-tag" style={{ background: '#10b981', color: '#000' }}>ONLINE</span>}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--app-text-muted)', marginTop: 2 }}>
                  {isConfigured
                    ? 'Launches automatically with `npm run dev` or `npm start`'
                    : 'Add your Bot Token in Settings to enable automated messaging.'}
                </div>
              </div>
            </div>

            {!isConfigured && (
              <button
                type="button"
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
              >
                Configure
              </button>
            )}
          </div>

          {/* Quick How-To Instructions */}
          <div style={{ background: '#0a0a0d', border: '1px solid var(--app-border)', borderRadius: 'var(--radius-md)', padding: 14 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="var(--app-primary)" />
              <span>How It Works Automatically</span>
            </div>
            <ol style={{ paddingLeft: 18, fontSize: '0.75rem', color: 'var(--app-text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>
                Whenever you run <code style={{ color: '#38bdf8' }}>npm run dev</code> or <code style={{ color: '#38bdf8' }}>npm start</code>, the web studio & 24/7 bot start together.
              </li>
              <li>
                Open Telegram and send <strong>any recipe URL</strong> to your bot (or in your Telegram channel).
              </li>
              <li>
                The bot extracts the recipe, original photos, and replies with a complete <strong>3-slide social deck</strong>!
              </li>
            </ol>
          </div>

          {/* Live Simulator Input */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={14} color="#38bdf8" />
              <span>Test Bot Input (Simulate Telegram Inbound Message)</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="url"
                className="form-input"
                placeholder="Paste any recipe URL to simulate incoming Telegram message..."
                value={testUrlInput}
                onChange={(e) => setTestUrlInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ flexShrink: 0 }}
                onClick={handleSimulateUrl}
                disabled={isProcessing || !testUrlInput.trim()}
              >
                <Play size={14} />
                <span>Test</span>
              </button>
            </div>
            {statusLog && (
              <div className="extraction-status-banner success" style={{ marginTop: 8, fontSize: '0.75rem' }}>
                <span>{statusLog}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            <span>Settings & Token</span>
          </button>
        </div>
      </div>
    </div>
  );
};
