import React, { useState, useEffect } from 'react';
import { TelegramConfig, AutoPilotConfig, ThemeId, BufferConfig, BufferProfile, AIConfig } from '../types';
import { testTelegramBot, sendSlideshowToTelegram } from '../utils/telegram';
import { 
  testGeminiApiKey, 
  testOpenRouterApiKey, 
  getStoredAIConfig, 
  saveStoredAIConfig, 
  OPENROUTER_MODELS, 
  GEMINI_MODELS 
} from '../utils/aiCaption';
import { fetchBufferProfiles } from '../utils/buffer';
import { extractRecipeFromUrl } from '../utils/recipeExtractor';
import { captureSlideAsBlob } from '../utils/exporter';
import { THEME_PRESETS } from '../data/presets';
import { 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink, 
  Save,
  Clock,
  Play,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  Share2,
  Check,
  Cpu,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'buffer' | 'ai' | 'telegram' | 'autopilot';
  config: TelegramConfig;
  onSaveConfig: (updated: TelegramConfig) => void;
  autoPilotConfig: AutoPilotConfig;
  onSaveAutoPilotConfig: (config: AutoPilotConfig) => void;
  onAutoPilotProcessed?: (newRecipe: any, theme: any) => void;
  slide1Ref: React.RefObject<HTMLDivElement>;
  slide2Ref: React.RefObject<HTMLDivElement>;
  slide3Ref: React.RefObject<HTMLDivElement>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'ai',
  config,
  onSaveConfig,
  autoPilotConfig,
  onSaveAutoPilotConfig,
  onAutoPilotProcessed,
  slide1Ref,
  slide2Ref,
  slide3Ref
}) => {
  const defaultBotToken = '';
  const defaultChatId = '1294588369';

  const [activeTab, setActiveTab] = useState<'buffer' | 'ai' | 'telegram' | 'autopilot'>(initialTab);
  const [formData, setFormData] = useState<TelegramConfig>(() => ({
    ...config,
    botToken: config?.botToken?.trim() || '',
    chatId: (config?.chatId && !config.chatId.includes('Claaaaaark')) ? config.chatId.trim() : defaultChatId
  }));
  const [autoPilotForm, setAutoPilotForm] = useState<AutoPilotConfig>(autoPilotConfig);

  // Unified AI Config State (Gemini & OpenRouter)
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => getStoredAIConfig());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [showBotToken, setShowBotToken] = useState(true);
  const [customOpenRouterModel, setCustomOpenRouterModel] = useState('');
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Buffer State
  const [bufferForm, setBufferForm] = useState<BufferConfig>(() => {
    try {
      const saved = localStorage.getItem('slyde_buffer_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      accessToken: '',
      selectedProfileIds: [],
      profiles: [],
      scheduleMode: 'queue'
    };
  });
  const [isFetchingBuffer, setIsFetchingBuffer] = useState(false);
  const [bufferResult, setBufferResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; botUsername?: string } | null>(null);

  const [isRunningAutoPilot, setIsRunningAutoPilot] = useState(false);
  const [autoPilotLog, setAutoPilotLog] = useState<string | null>(null);

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setFormData({
        ...config,
        botToken: config?.botToken?.trim() || defaultBotToken,
        chatId: config?.chatId?.trim() || defaultChatId
      });
      setAutoPilotForm(autoPilotConfig);
      setTestResult(null);
      setAiTestResult(null);

      // Load AI config from localStorage & server
      const stored = getStoredAIConfig();
      setAiConfig(stored);

      const isKnown = OPENROUTER_MODELS.some(m => m.id === stored.openRouterModel);
      if (!isKnown && stored.openRouterModel) {
        setCustomOpenRouterModel(stored.openRouterModel);
      }

      fetch('/api/get-ai-config')
        .then(r => r.json())
        .then(data => {
          if (data && (data.geminiApiKey || data.openRouterApiKey)) {
            setAiConfig(prev => ({
              ...prev,
              ...data
            }));
          }
        })
        .catch(() => {});

      // Load Buffer config
      fetch('/api/get-buffer-config')
        .then(r => r.json())
        .then(data => {
          if (data?.accessToken) {
            setBufferForm(prev => ({
              ...prev,
              accessToken: data.accessToken,
              selectedProfileIds: data.selectedProfileIds || prev.selectedProfileIds,
              profiles: data.profiles || prev.profiles
            }));
          }
        })
        .catch(() => {});
    }
  }, [isOpen, config, autoPilotConfig]);

  if (!isOpen) return null;

  const handleTestAi = async () => {
    setAiTestResult(null);
    setIsTestingAi(true);

    if (aiConfig.provider === 'openrouter') {
      if (!aiConfig.openRouterApiKey.trim()) {
        setAiTestResult({ success: false, message: 'Please enter an OpenRouter API Key.' });
        setIsTestingAi(false);
        return;
      }
      const modelToUse = aiConfig.openRouterModel === 'custom' ? customOpenRouterModel.trim() : aiConfig.openRouterModel;
      const res = await testOpenRouterApiKey(aiConfig.openRouterApiKey, modelToUse);
      setAiTestResult(res);
      setIsTestingAi(false);

      if (res.success) {
        const updated = {
          ...aiConfig,
          openRouterModel: aiConfig.openRouterModel === 'custom' ? customOpenRouterModel.trim() : aiConfig.openRouterModel
        };
        saveStoredAIConfig(updated);
        fetch('/api/save-ai-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        }).catch(() => {});
      }
    } else {
      if (!aiConfig.geminiApiKey.trim()) {
        setAiTestResult({ success: false, message: 'Please enter a Gemini API Key.' });
        setIsTestingAi(false);
        return;
      }
      const res = await testGeminiApiKey(aiConfig.geminiApiKey, aiConfig.geminiModel);
      setAiTestResult(res);
      setIsTestingAi(false);

      if (res.success) {
        saveStoredAIConfig(aiConfig);
        fetch('/api/save-ai-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiConfig)
        }).catch(() => {});
      }
    }
  };

  const handleConnectBuffer = async () => {
    if (!bufferForm.accessToken.trim()) {
      setBufferResult({ success: false, message: 'Please enter a Buffer Access Token.' });
      return;
    }

    setIsFetchingBuffer(true);
    setBufferResult(null);

    const res = await fetchBufferProfiles(bufferForm.accessToken);
    setIsFetchingBuffer(false);

    if (res.success && res.profiles) {
      const updated = {
        ...bufferForm,
        profiles: res.profiles,
        selectedProfileIds: bufferForm.selectedProfileIds.length > 0 
          ? bufferForm.selectedProfileIds 
          : res.profiles.map(p => p.id)
      };
      setBufferForm(updated);
      setBufferResult({ success: true, message: res.message });

      // Save to storage & server
      localStorage.setItem('slyde_buffer_config', JSON.stringify(updated));
      fetch('/api/save-buffer-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }).catch(() => {});
    } else {
      setBufferResult({ success: false, message: res.message });
    }
  };

  const toggleBufferProfile = (id: string) => {
    const isSelected = bufferForm.selectedProfileIds.includes(id);
    const updatedIds = isSelected 
      ? bufferForm.selectedProfileIds.filter(pid => pid !== id)
      : [...bufferForm.selectedProfileIds, id];
    setBufferForm({ ...bufferForm, selectedProfileIds: updatedIds });
  };

  const handleTestConnection = async () => {
    if (!formData.botToken.trim()) {
      setTestResult({ success: false, message: 'Please enter your Telegram Bot Token.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testTelegramBot(formData.botToken, formData.chatId);
    setTestResult(res);
    setIsTesting(false);

    if (res.success) {
      onSaveConfig(formData);
    }
  };

  const handleSave = () => {
    onSaveConfig(formData);
    onSaveAutoPilotConfig(autoPilotForm);

    // Save AI Config
    const finalAiConfig: AIConfig = {
      ...aiConfig,
      openRouterModel: aiConfig.openRouterModel === 'custom' && customOpenRouterModel.trim() 
        ? customOpenRouterModel.trim() 
        : aiConfig.openRouterModel
    };
    saveStoredAIConfig(finalAiConfig);

    fetch('/api/save-ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalAiConfig)
    }).catch(() => {});

    // Save Buffer Config
    localStorage.setItem('slyde_buffer_config', JSON.stringify(bufferForm));
    fetch('/api/save-buffer-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bufferForm)
    }).catch(() => {});

    onClose();
  };

  const handleRunAutoPilotNow = async () => {
    if (autoPilotForm.urlsQueue.length === 0) {
      setAutoPilotLog('No URLs currently queued in the Auto-Pilot list.');
      return;
    }

    const nextUrl = autoPilotForm.urlsQueue[0];
    setIsRunningAutoPilot(true);
    setAutoPilotLog(`🍳 Auto-Pilot: Extracting next recipe from ${nextUrl}...`);

    try {
      const extracted = await extractRecipeFromUrl(nextUrl);

      const themeKeys = Object.keys(THEME_PRESETS) as ThemeId[];
      let selectedTheme = THEME_PRESETS['caramel'];

      if (autoPilotForm.themeRotation === 'random') {
        const randKey = themeKeys[Math.floor(Math.random() * themeKeys.length)];
        selectedTheme = THEME_PRESETS[randKey];
      } else if (autoPilotForm.themeRotation === 'rotate') {
        const nextIdx = (autoPilotForm.historyLogs.length + 1) % themeKeys.length;
        selectedTheme = THEME_PRESETS[themeKeys[nextIdx]];
      }

      onAutoPilotProcessed?.(extracted, selectedTheme);

      if (autoPilotForm.autoPublishTelegram && formData.botToken && formData.chatId) {
        setAutoPilotLog('🚀 Auto-Pilot: Publishing 3-slide photo album to Telegram...');
        
        await new Promise(r => setTimeout(r, 600));

        const elements = [slide1Ref.current, slide2Ref.current, slide3Ref.current].filter(Boolean) as HTMLElement[];
        if (elements.length >= 3) {
          const blobs: Blob[] = [];
          for (const el of elements) {
            blobs.push(await captureSlideAsBlob(el, 2));
          }
          const res = await sendSlideshowToTelegram(formData, blobs, extracted);
          if (res.success) {
            setAutoPilotLog(`🎉 Auto-Pilot published successfully to Telegram!`);
            confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
          } else {
            setAutoPilotLog(`Telegram status: ${res.message}`);
          }
        }
      }

      const updatedQueue = autoPilotForm.urlsQueue.slice(1);
      const newLog = {
        id: String(Date.now()),
        timestamp: Date.now(),
        title: extracted.title,
        status: 'success' as const,
        theme: selectedTheme.name,
        url: nextUrl
      };

      setAutoPilotForm({
        ...autoPilotForm,
        urlsQueue: updatedQueue,
        historyLogs: [newLog, ...autoPilotForm.historyLogs.slice(0, 9)]
      });

    } catch (e: any) {
      setAutoPilotLog(`Auto-Pilot Error: ${e.message}`);
    } finally {
      setIsRunningAutoPilot(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 660 }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={20} color="var(--app-primary)" />
            <span>Studio Settings & Integrations</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="editor-nav-tabs" style={{ padding: '0 20px', background: 'transparent', gap: 4 }}>
          <button
            type="button"
            className={`editor-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={14} />
            <span>AI Engine ({aiConfig.provider === 'openrouter' ? 'OpenRouter' : 'Gemini'})</span>
          </button>
          <button
            type="button"
            className={`editor-tab-btn ${activeTab === 'buffer' ? 'active' : ''}`}
            onClick={() => setActiveTab('buffer')}
          >
            <Share2 size={14} />
            <span>Buffer Scheduling</span>
          </button>
          <button
            type="button"
            className={`editor-tab-btn ${activeTab === 'telegram' ? 'active' : ''}`}
            onClick={() => setActiveTab('telegram')}
          >
            <Send size={14} />
            <span>Telegram Bot</span>
          </button>
          <button
            type="button"
            className={`editor-tab-btn ${activeTab === 'autopilot' ? 'active' : ''}`}
            onClick={() => setActiveTab('autopilot')}
          >
            <Clock size={14} />
            <span>Auto-Pilot</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto', padding: 22 }}>
          
          {/* ================= TAB 1: AI ENGINE (GEMINI & OPENROUTER) ================= */}
          {activeTab === 'ai' && (
            <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header & Provider Segmented Selector */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={16} color="var(--app-primary)" />
                    <span>AI Caption Engine</span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--app-text-muted)' }}>
                    Generates viral recipe hooks and hashtags for social platforms.
                  </span>
                </div>

                {/* Compact Segmented Switcher */}
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--app-border)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAiConfig({ ...aiConfig, provider: 'gemini' });
                      setAiTestResult(null);
                    }}
                    style={{
                      background: aiConfig.provider === 'gemini' ? 'var(--app-primary)' : 'transparent',
                      color: aiConfig.provider === 'gemini' ? '#000000' : 'var(--app-text-muted)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Zap size={13} />
                    <span>Google Gemini</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAiConfig({ ...aiConfig, provider: 'openrouter' });
                      setAiTestResult(null);
                    }}
                    style={{
                      background: aiConfig.provider === 'openrouter' ? 'var(--app-primary)' : 'transparent',
                      color: aiConfig.provider === 'openrouter' ? '#000000' : 'var(--app-text-muted)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Sparkles size={13} />
                    <span>OpenRouter</span>
                  </button>
                </div>
              </div>

              {/* ============ OPENROUTER SETTINGS ============ */}
              {aiConfig.provider === 'openrouter' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Row 1: API Key + Inline Verify */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>OpenRouter API Key</label>
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="form-label-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <span>Get Key</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showOpenRouterKey ? 'text' : 'password'}
                          className="form-input"
                          style={{ paddingRight: 38 }}
                          placeholder="sk-or-v1-..."
                          value={aiConfig.openRouterApiKey}
                          onChange={(e) => setAiConfig({ ...aiConfig, openRouterApiKey: e.target.value })}
                        />
                        <button
                          type="button"
                          style={{
                            position: 'absolute',
                            right: 8,
                            background: 'none',
                            border: 'none',
                            color: 'var(--app-text-muted)',
                            cursor: 'pointer',
                            padding: 4
                          }}
                          onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                        >
                          {showOpenRouterKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: 38, padding: '0 14px', flexShrink: 0, gap: 6 }}
                        onClick={handleTestAi}
                        disabled={isTestingAi || !aiConfig.openRouterApiKey.trim()}
                      >
                        {isTestingAi ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <>
                            <Key size={13} />
                            <span>Verify</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Side-by-Side Model Preset & Model ID */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ marginBottom: 6 }}>Model Preset</label>
                      <select
                        className="form-select"
                        value={OPENROUTER_MODELS.some(m => m.id === aiConfig.openRouterModel && m.id !== 'custom') ? aiConfig.openRouterModel : 'custom'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            setAiConfig({ ...aiConfig, openRouterModel: customOpenRouterModel.trim() || 'openrouter/free' });
                          } else {
                            setCustomOpenRouterModel(val);
                            setAiConfig({ ...aiConfig, openRouterModel: val });
                          }
                        }}
                      >
                        {OPENROUTER_MODELS.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ marginBottom: 6 }}>Model Identifier</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. openrouter/free"
                        value={aiConfig.openRouterModel === 'custom' ? customOpenRouterModel : aiConfig.openRouterModel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomOpenRouterModel(val);
                          setAiConfig({ ...aiConfig, openRouterModel: val });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============ GOOGLE GEMINI SETTINGS ============ */}
              {aiConfig.provider === 'gemini' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Row 1: API Key + Inline Verify */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Gemini API Key</label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="form-label-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <span>Get Free Key</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showGeminiKey ? 'text' : 'password'}
                          className="form-input"
                          style={{ paddingRight: 38 }}
                          placeholder="AIzaSy..."
                          value={aiConfig.geminiApiKey}
                          onChange={(e) => setAiConfig({ ...aiConfig, geminiApiKey: e.target.value })}
                        />
                        <button
                          type="button"
                          style={{
                            position: 'absolute',
                            right: 8,
                            background: 'none',
                            border: 'none',
                            color: 'var(--app-text-muted)',
                            cursor: 'pointer',
                            padding: 4
                          }}
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                        >
                          {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: 38, padding: '0 14px', flexShrink: 0, gap: 6 }}
                        onClick={handleTestAi}
                        disabled={isTestingAi || !aiConfig.geminiApiKey.trim()}
                      >
                        {isTestingAi ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <>
                            <Key size={13} />
                            <span>Verify</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Model Select */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: 6 }}>Gemini Model</label>
                    <select
                      className="form-select"
                      value={aiConfig.geminiModel || 'gemini-2.5-flash'}
                      onChange={(e) => setAiConfig({ ...aiConfig, geminiModel: e.target.value })}
                    >
                      {GEMINI_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Status / Verification Result Banner */}
              {aiTestResult && (
                <div
                  className={`extraction-status-banner ${aiTestResult.success ? 'success' : 'error'}`}
                  style={{ marginTop: 2, padding: '8px 12px' }}
                >
                  {aiTestResult.success ? (
                    <CheckCircle2 size={15} color="#10b981" />
                  ) : (
                    <AlertCircle size={15} color="#ef4444" />
                  )}
                  <span style={{ fontSize: '0.80rem' }}>{aiTestResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: BUFFER SCHEDULING ================= */}
          {activeTab === 'buffer' && (
            <div className="settings-section">
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff', marginBottom: 4 }}>
                Buffer Social Media Scheduling Integration
              </div>
              <p style={{ fontSize: '0.80rem', color: 'var(--app-text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
                Connect Buffer to schedule 3-slide recipe carousels and AI captions across Instagram, TikTok, Pinterest, Facebook, and LinkedIn.
              </p>

              <div className="form-group">
                <label className="form-label">
                  <span>Buffer Access Token</span>
                  <a
                    href="https://buffer.com/manage/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="form-label-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>Get Buffer Token</span>
                    <ExternalLink size={12} />
                  </a>
                </label>

                <input
                  type="password"
                  className="form-input"
                  placeholder="1/abcdef1234567890..."
                  value={bufferForm.accessToken}
                  onChange={(e) => setBufferForm({ ...bufferForm, accessToken: e.target.value })}
                />
              </div>

              {/* Connect Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleConnectBuffer}
                  disabled={isFetchingBuffer || !bufferForm.accessToken.trim()}
                >
                  {isFetchingBuffer ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Connecting to Buffer...</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={15} />
                      <span>Fetch Channels & Test Token</span>
                    </>
                  )}
                </button>
              </div>

              {bufferResult && (
                <div
                  className={`extraction-status-banner ${bufferResult.success ? 'success' : 'error'}`}
                  style={{ marginTop: 14 }}
                >
                  {bufferResult.success ? (
                    <CheckCircle2 size={16} color="#10b981" />
                  ) : (
                    <AlertCircle size={16} color="#ef4444" />
                  )}
                  <span>{bufferResult.message}</span>
                </div>
              )}

              {/* Connected Profiles Selector */}
              {bufferForm.profiles && bufferForm.profiles.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <label className="form-label" style={{ marginBottom: 8 }}>
                    <span>Select Active Channels for 1-Click Scheduling:</span>
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {bufferForm.profiles.map((p: BufferProfile) => {
                      const isChecked = bufferForm.selectedProfileIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleBufferProfile(p.id)}
                          style={{
                            background: isChecked ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${isChecked ? 'var(--app-primary)' : 'var(--app-border)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {p.avatar ? (
                              <img src={p.avatar} alt={p.formatted_username} style={{ width: 26, height: 26, borderRadius: '50%' }} />
                            ) : (
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                                {p.service[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#ffffff' }}>{p.formatted_username}</div>
                              <div style={{ fontSize: '0.70rem', color: 'var(--app-text-muted)', textTransform: 'capitalize' }}>{p.service}</div>
                            </div>
                          </div>

                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              background: isChecked ? 'var(--app-primary)' : 'transparent',
                              border: `1.5px solid ${isChecked ? 'var(--app-primary)' : 'var(--app-border)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {isChecked && <Check size={14} color="#000" strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: TELEGRAM BOT ================= */}
          {activeTab === 'telegram' && (
            <div className="settings-section">
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff', marginBottom: 4 }}>
                24/7 Telegram Direct Publishing & Inbound Bot
              </div>
              <p style={{ fontSize: '0.80rem', color: 'var(--app-text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
                Receive recipe links in Telegram and publish 3-slide photo carousels to your Telegram channels in 1 click.
              </p>

              <div className="form-group">
                <label className="form-label">
                  <span>Telegram Bot Token</span>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="form-label-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>Create Bot via @BotFather</span>
                    <ExternalLink size={12} />
                  </a>
                </label>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showBotToken ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingRight: 36 }}
                    placeholder="Enter Bot Token (e.g. 123456:ABC-DEF...)"
                    value={formData.botToken}
                    onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowBotToken(prev => !prev)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--app-text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={showBotToken ? 'Hide Bot Token' : 'Show Bot Token'}
                  >
                    {showBotToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Target Chat ID / Channel Username / Group ID</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="@yourchannel, -100123456789, or your numeric User ID"
                  value={formData.chatId || ''}
                  onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
                />
                <div style={{ fontSize: '0.70rem', color: 'var(--app-text-muted)', marginTop: 4 }}>
                  💡 To receive slides directly, enter your personal numeric Chat ID (message <code>/start</code> to @Claaaaaarkbot to see your ID) or your Channel username (e.g. <code>@mychannel</code> where @Claaaaaarkbot is added as an Admin).
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Forum Topic / Message Thread ID (Optional)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2381 (Leave blank for standard chat)"
                  value={formData.messageThreadId || ''}
                  onChange={(e) => setFormData({ ...formData, messageThreadId: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleTestConnection}
                  disabled={isTesting || !formData.botToken.trim()}
                >
                  {isTesting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Testing Bot...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>
              </div>

              {testResult && (
                <div
                  className={`extraction-status-banner ${testResult.success ? 'success' : 'error'}`}
                  style={{ marginTop: 14 }}
                >
                  {testResult.success ? (
                    <CheckCircle2 size={16} color="#10b981" />
                  ) : (
                    <AlertCircle size={16} color="#ef4444" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: AUTOPILOT ================= */}
          {activeTab === 'autopilot' && (
            <div className="settings-section">
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff', marginBottom: 4 }}>
                Auto-Pilot Zero-Touch Daily Posting
              </div>
              <p style={{ fontSize: '0.80rem', color: 'var(--app-text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
                Automatically process recipes from your queue, rotate themes, and publish carousels on a schedule.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Schedule Time (UTC/Local)</label>
                  <input
                    type="time"
                    className="form-input"
                    value={autoPilotForm.scheduleTime}
                    onChange={(e) => setAutoPilotForm({ ...autoPilotForm, scheduleTime: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Theme Variety Strategy</label>
                  <select
                    className="form-select"
                    value={autoPilotForm.themeRotation}
                    onChange={(e) => setAutoPilotForm({ ...autoPilotForm, themeRotation: e.target.value as any })}
                  >
                    <option value="rotate">🔄 Auto-Rotate 10 Themes</option>
                    <option value="random">🎲 Random Surprise Theme</option>
                    <option value="fixed">🔒 Fixed Theme</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>URL Queue for Daily Auto-Publish ({autoPilotForm.urlsQueue.length} queued)</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--app-text-dim)' }}>One recipe URL per line</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Paste 5-30 recipe URLs to queue for daily posting..."
                  value={autoPilotForm.urlsQueue.join('\n')}
                  onChange={(e) => setAutoPilotForm({ ...autoPilotForm, urlsQueue: e.target.value.split('\n').filter(Boolean) })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleRunAutoPilotNow}
                  disabled={isRunningAutoPilot || autoPilotForm.urlsQueue.length === 0}
                >
                  {isRunningAutoPilot ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Executing Zero-Touch Pipeline...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      <span>Run Auto-Pilot Test Now (Next URL)</span>
                    </>
                  )}
                </button>

                {autoPilotLog && (
                  <div className="extraction-status-banner success" style={{ fontSize: '0.78rem' }}>
                    <span>{autoPilotLog}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
