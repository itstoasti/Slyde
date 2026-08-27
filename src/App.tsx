import React, { useState, useEffect, useRef } from 'react';
import { RecipeData, ThemeConfig, AspectRatio, TelegramConfig, StudioViewMode, AutoPilotConfig, ThemeId } from './types';
import { RECIPE_PRESETS, THEME_PRESETS, DEFAULT_SLIDE2_CONFIG, DEFAULT_AUTOPILOT_CONFIG, DEFAULT_PERKS } from './data/presets';
import { Header } from './components/Header';
import { RecipeQueueRibbon } from './components/RecipeQueueRibbon';
import { UrlInputBar } from './components/UrlInputBar';
import { EditorPanel } from './components/EditorPanel';
import { PhoneSimulator } from './components/PhoneSimulator';
import { StoryboardView } from './components/StoryboardView';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { startTelegramListener, stopTelegramListener } from './utils/telegramListener';
import { captureSlideAsBlob } from './utils/exporter';
import { sendSlideshowToTelegram } from './utils/telegram';
import confetti from 'canvas-confetti';

const STORAGE_KEY_TELEGRAM = 'slyde_telegram_config';
const STORAGE_KEY_BRANDING = 'slyde_branding_defaults';
const STORAGE_KEY_AUTOPILOT = 'slyde_autopilot_config';
const STORAGE_KEY_RECIPES = 'slyde_recipes_queue';
const STORAGE_KEY_ACTIVE_RECIPE = 'slyde_active_recipe_id';

export const App: React.FC = () => {
  // Recipe Queue State with localStorage persistence
  const [recipesQueue, setRecipesQueue] = useState<RecipeData[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_RECIPES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Update presets with latest default perks if needed
          return parsed.map((r: RecipeData) => ({
            ...r,
            perks: r.perks && r.perks.length === 4 && r.perks[0].title === 'Save from anywhere' ? [...DEFAULT_PERKS] : (r.perks || [...DEFAULT_PERKS])
          }));
        }
      } catch (e) {}
    }
    return RECIPE_PRESETS;
  });

  const [activeRecipeId, setActiveRecipeId] = useState<string>(() => {
    const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_RECIPE);
    if (savedId) return savedId;
    const savedList = localStorage.getItem(STORAGE_KEY_RECIPES);
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList);
        if (Array.isArray(parsed) && parsed[0]?.id) return parsed[0].id;
      } catch (e) {}
    }
    return RECIPE_PRESETS[0].id;
  });

  // Sync recipesQueue to localStorage & disk automatically
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RECIPES, JSON.stringify(recipesQueue));
    } catch (e) {}

    const timer = setTimeout(() => {
      fetch('/api/save-recipes-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes: recipesQueue })
      }).catch(() => {});
    }, 400);

    return () => clearTimeout(timer);
  }, [recipesQueue]);

  // Sync activeRecipeId to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_RECIPE, activeRecipeId);
    } catch (e) {}
  }, [activeRecipeId]);

  const activeRecipe = recipesQueue.find((r) => r.id === activeRecipeId) || recipesQueue[0] || RECIPE_PRESETS[0];

  const [theme, setTheme] = useState<ThemeConfig>(THEME_PRESETS.caramel);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => {
    const saved = localStorage.getItem('slyde_aspect_ratio');
    if (saved === '1:1' || saved === '9:16' || saved === '4:5') return saved;
    return '9:16';
  });

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    try {
      localStorage.setItem('slyde_aspect_ratio', ratio);
    } catch (e) {}
    showToast(ratio === '1:1' ? 'Switched to Instagram Square format (1:1)' : 'Switched to TikTok Vertical format (9:16)', 'info');
  };

  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [viewMode, setViewMode] = useState<StudioViewMode>('phone');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);

  // Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [globalToast, setGlobalToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // References for capturing slides
  const slide1Ref = useRef<HTMLDivElement>(null);
  const slide2Ref = useRef<HTMLDivElement>(null);
  const slide3Ref = useRef<HTMLDivElement>(null);

const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: '8436957773:AAHIDTS-uDg6Kv8brHhMK5UYBxkHy3dewzk',
  chatId: '@Claaaaaarkbot',
  includeCaption: true,
  sendAsAlbum: true,
  inboundListenerEnabled: true
};

  const [settingsInitialTab, setSettingsInitialTab] = useState<'buffer' | 'ai' | 'telegram' | 'autopilot'>('ai');

  // Telegram Config from localStorage or default pre-loaded
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TELEGRAM);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            botToken: parsed.botToken || DEFAULT_TELEGRAM_CONFIG.botToken,
            chatId: parsed.chatId || DEFAULT_TELEGRAM_CONFIG.chatId,
            includeCaption: parsed.includeCaption ?? true,
            sendAsAlbum: parsed.sendAsAlbum ?? true,
            inboundListenerEnabled: parsed.inboundListenerEnabled ?? true,
            messageThreadId: parsed.messageThreadId
          };
        }
      } catch (e) {}
    }
    return DEFAULT_TELEGRAM_CONFIG;
  });

  // Branding Defaults from localStorage
  const [brandDefaults, setBrandDefaults] = useState<{ brandName: string; socialHandle: string; ctaUrl: string; brandLogo?: string; brandLogoSize?: number }>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BRANDING);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      brandName: 'SnapRecipes',
      socialHandle: '@snaprecipes',
      ctaUrl: 'snaprecipes.xyz',
      brandLogo: '/snaprecipes-app-icon.png',
      brandLogoSize: 58
    };
  });

  // Auto-Save Branding Defaults to localStorage and server
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(brandDefaults));
    } catch (e) {}

    fetch('/api/save-branding-defaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brandDefaults)
    }).catch(() => {});
  }, [brandDefaults]);

  // AutoPilot Config from localStorage
  const [autoPilotConfig, setAutoPilotConfig] = useState<AutoPilotConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AUTOPILOT);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_AUTOPILOT_CONFIG;
  });

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setGlobalToast({ message, type });
    setTimeout(() => {
      setGlobalToast(null);
    }, 4500);
  };

  // Hydrate configurations from server & disk on initial mount
  useEffect(() => {
    // 1. Telegram
    fetch('/api/get-telegram-config')
      .then(res => res.json())
      .then(data => {
        if (data && (data.botToken || data.chatId)) {
          setTelegramConfig(prev => {
            const merged = {
              ...prev,
              ...data,
              botToken: prev.botToken || data.botToken || DEFAULT_TELEGRAM_CONFIG.botToken,
              chatId: prev.chatId || data.chatId || DEFAULT_TELEGRAM_CONFIG.chatId
            };
            try {
              localStorage.setItem(STORAGE_KEY_TELEGRAM, JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      })
      .catch(() => {});

    // 2. Branding Defaults (Logo, Size, CTA)
    fetch('/api/get-branding-defaults')
      .then(res => res.json())
      .then(data => {
        if (data && (data.brandName || data.brandLogo)) {
          setBrandDefaults(prev => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});

    // 3. Saved Recipes Queue from Disk (if present)
    fetch('/api/get-recipes-queue')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.recipes) && data.recipes.length > 0) {
          const hasLocal = localStorage.getItem(STORAGE_KEY_RECIPES);
          if (!hasLocal) {
            setRecipesQueue(data.recipes);
            if (data.recipes[0]?.id) setActiveRecipeId(data.recipes[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Live Inbound Telegram Bot Listener
  useEffect(() => {
    if (!telegramConfig.botToken || !telegramConfig.inboundListenerEnabled) {
      stopTelegramListener();
      return;
    }

    startTelegramListener(
      telegramConfig,
      theme,
      brandDefaults,
      {
        onRecipeReceived: (newRecipe, senderName) => {
          setRecipesQueue(prev => {
            const exists = prev.find(r => r.id === newRecipe.id);
            if (exists) return prev;
            return [newRecipe, ...prev];
          });
          setActiveRecipeId(newRecipe.id);
          setCurrentSlide(0);
          showToast(`⚡ Telegram: Generated 3 slides for "${newRecipe.title}" from @${senderName}!`, 'success');
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        },
        onStatusUpdate: (status) => {
          showToast(status, 'info');
        },
        slide1Ref,
        slide2Ref,
        slide3Ref
      }
    );

    return () => {
      stopTelegramListener();
    };
  }, [telegramConfig.botToken, telegramConfig.inboundListenerEnabled, theme, brandDefaults]);

  // Randomize / Rotate Theme
  const handleRandomizeTheme = () => {
    const keys = Object.keys(THEME_PRESETS) as ThemeId[];
    const currentIdx = keys.indexOf(theme.id);
    const nextKey = keys[(currentIdx + 1) % keys.length];
    setTheme(THEME_PRESETS[nextKey]);
    showToast(`Switched theme to "${THEME_PRESETS[nextKey].name}"`, 'info');
  };

  const handleUpdateActiveRecipe = (updated: RecipeData) => {
    setRecipesQueue((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );

    // If branding fields were changed, automatically update global branding defaults
    if (
      updated.brandName !== brandDefaults.brandName ||
      updated.brandLogo !== brandDefaults.brandLogo ||
      updated.brandLogoSize !== brandDefaults.brandLogoSize ||
      updated.ctaUrl !== brandDefaults.ctaUrl ||
      updated.socialHandle !== brandDefaults.socialHandle
    ) {
      setBrandDefaults({
        brandName: updated.brandName || 'SnapRecipes',
        socialHandle: updated.socialHandle || '@snaprecipes',
        ctaUrl: updated.ctaUrl || 'snaprecipes.xyz',
        brandLogo: updated.brandLogo,
        brandLogoSize: updated.brandLogoSize
      });
    }
  };

  const handleSelectRecipe = (selected: RecipeData) => {
    setActiveRecipeId(selected.id);
  };

  const handleRemoveFromQueue = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (recipesQueue.length <= 1) return;
    const remaining = recipesQueue.filter((r) => r.id !== id);
    setRecipesQueue(remaining);
    if (activeRecipeId === id) {
      setActiveRecipeId(remaining[0].id);
    }
  };

  const handleAddNewBlankRecipe = () => {
    const newRecipe: RecipeData = {
      id: `custom-${Date.now()}`,
      title: 'CUSTOM HEALTHY RECIPE',
      shortHook: 'Quick, fresh, and ready in minutes without any complicated kitchen steps.',
      taglineBadge: `• ${brandDefaults.brandName.toUpperCase()} · SKIP THE LIFE STORY`,
      heroImage: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=85',
      prepTime: '5m',
      cookTime: '10m',
      servings: '2',
      calories: '≈320 cal',
      proteinCallout: '30g of protein',
      highlightBadge: '15 MIN · 2 SERVINGS',
      ingredients: [
        { name: 'Fresh Chicken Breast or Tofu', amount: '12 oz (340g)' },
        { name: 'Mixed Vegetables & Greens', amount: '2 cups' },
        { name: 'Extra Virgin Olive Oil', amount: '1 tbsp' }
      ],
      method: [
        'Slice main protein and vegetables into even pieces.',
        'Sauté in a preheated hot skillet for 6-8 minutes.',
        'Season to taste and serve fresh.'
      ],
      brandName: brandDefaults.brandName,
      brandSubtitle: 'Save any recipe in one tap.',
      brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
      brandLogo: brandDefaults.brandLogo || '/snaprecipes-app-icon.png',
      brandLogoSize: brandDefaults.brandLogoSize || 58,
      ctaButtonText: 'Get the app — free',
      ctaUrl: brandDefaults.ctaUrl,
      socialHandle: brandDefaults.socialHandle,
      perks: [...DEFAULT_PERKS],
      slide2Config: { ...DEFAULT_SLIDE2_CONFIG }
    };

    setRecipesQueue((prev) => [newRecipe, ...prev]);
    setActiveRecipeId(newRecipe.id);
    showToast('Created new blank recipe template', 'info');
  };

  const handleRecipeExtracted = (extracted: RecipeData) => {
    setRecipesQueue((prev) => [extracted, ...prev]);
    setActiveRecipeId(extracted.id);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.5 } });
  };

  const handleMultipleExtracted = (extractedList: RecipeData[]) => {
    setRecipesQueue((prev) => [...extractedList, ...prev]);
    if (extractedList.length > 0) {
      setActiveRecipeId(extractedList[0].id);
    }
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
  };

  const handleSaveTelegramConfig = (updated: TelegramConfig) => {
    setTelegramConfig(updated);
    localStorage.setItem(STORAGE_KEY_TELEGRAM, JSON.stringify(updated));

    // Sync to disk for bot.js
    fetch('/api/save-telegram-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(() => {});

    showToast('Telegram configuration saved and synced to 24/7 bot!', 'success');
  };

  const [isSendingTelegramQuick, setIsSendingTelegramQuick] = useState(false);

  const handleQuickSendTelegram = async () => {
    const activeBotToken = telegramConfig?.botToken?.trim() || DEFAULT_TELEGRAM_CONFIG.botToken;
    const activeChatId = telegramConfig?.chatId?.trim() || DEFAULT_TELEGRAM_CONFIG.chatId;

    const activeConfig: TelegramConfig = {
      botToken: activeBotToken,
      chatId: activeChatId,
      includeCaption: telegramConfig?.includeCaption ?? true,
      sendAsAlbum: telegramConfig?.sendAsAlbum ?? true,
      inboundListenerEnabled: telegramConfig?.inboundListenerEnabled ?? true,
      messageThreadId: telegramConfig?.messageThreadId
    };

    const elements = [slide1Ref.current, slide2Ref.current, slide3Ref.current].filter(Boolean) as HTMLElement[];
    if (elements.length < 3) {
      showToast('Rendering slide previews for Telegram...', 'info');
      return;
    }

    setIsSendingTelegramQuick(true);
    showToast(`🚀 Publishing 3-slide photo album to ${activeChatId}...`, 'info');
    try {
      const blobs: Blob[] = [];
      for (const el of elements) {
        blobs.push(await captureSlideAsBlob(el, 2));
      }
      const res = await sendSlideshowToTelegram(activeConfig, blobs, activeRecipe, (msg) => {
        showToast(msg, 'info');
      });

      if (res.success) {
        showToast(res.message || `✓ 3-Slide carousel published to ${activeChatId}! 🚀`, 'success');
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      } else {
        showToast(res.message || 'Telegram upload failed', 'error');
      }
    } catch (err: any) {
      showToast(`Telegram upload error: ${err.message}`, 'error');
    } finally {
      setIsSendingTelegramQuick(false);
    }
  };

  const handleSaveAutoPilotConfig = (config: AutoPilotConfig) => {
    setAutoPilotConfig(config);
    localStorage.setItem(STORAGE_KEY_AUTOPILOT, JSON.stringify(config));
    showToast(`Auto-Pilot scheduler updated (${config.enabled ? 'Active' : 'Disabled'})`, 'success');
  };

  return (
    <div className="app-root">
      {/* Header Bar */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onSendTelegram={handleQuickSendTelegram}
        isSendingTelegram={isSendingTelegramQuick}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        onRandomizeTheme={handleRandomizeTheme}
        currentTheme={theme}
        isLeftPanelOpen={isLeftPanelOpen}
        onToggleLeftPanel={() => setIsLeftPanelOpen(prev => !prev)}
      />

      {/* Recipe Queue & Multi-Recipe Switcher Ribbon */}
      <RecipeQueueRibbon
        queue={recipesQueue}
        activeId={activeRecipeId}
        onSelectRecipe={handleSelectRecipe}
        onRemoveFromQueue={handleRemoveFromQueue}
        onAddNewBlank={handleAddNewBlankRecipe}
      />

      {/* Main Studio Workspace */}
      <div className="app-workspace">
        {/* Left Side: URL Extraction & Slide Content Editor (Collapsible) */}
        {isLeftPanelOpen && (
          <div className="workspace-left-panel">
            <UrlInputBar
              onRecipeExtracted={handleRecipeExtracted}
              onMultipleExtracted={handleMultipleExtracted}
              brandDefaults={brandDefaults}
            />

            <EditorPanel
              recipe={activeRecipe}
              theme={theme}
              aspectRatio={aspectRatio}
              onChangeAspectRatio={handleAspectRatioChange}
              onUpdateRecipe={handleUpdateActiveRecipe}
              onUpdateTheme={setTheme}
            />
          </div>
        )}

        {/* Right Side: Interactive Phone Preview Studio OR Storyboard View */}
        <div className="workspace-right-panel">
          {viewMode === 'phone' ? (
            <PhoneSimulator
              recipe={activeRecipe}
              theme={theme}
              aspectRatio={aspectRatio}
              currentSlide={currentSlide}
              onSlideChange={setCurrentSlide}
              slide1Ref={slide1Ref}
              slide2Ref={slide2Ref}
              slide3Ref={slide3Ref}
            />
          ) : (
            <StoryboardView
              recipe={activeRecipe}
              theme={theme}
              aspectRatio={aspectRatio}
              onEditSlide={(idx) => {
                setCurrentSlide(idx);
                setViewMode('phone');
              }}
              slide1Ref={slide1Ref}
              slide2Ref={slide2Ref}
              slide3Ref={slide3Ref}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsInitialTab}
        config={telegramConfig}
        onSaveConfig={handleSaveTelegramConfig}
        autoPilotConfig={autoPilotConfig}
        onSaveAutoPilotConfig={handleSaveAutoPilotConfig}
        onAutoPilotProcessed={(newRecipe, newTheme) => {
          setRecipesQueue((prev) => [newRecipe, ...prev]);
          setActiveRecipeId(newRecipe.id);
          setTheme(newTheme);
        }}
        slide1Ref={slide1Ref}
        slide2Ref={slide2Ref}
        slide3Ref={slide3Ref}
      />

      {/* Export & Video Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        recipe={activeRecipe}
        aspectRatio={aspectRatio}
        slide1Ref={slide1Ref}
        slide2Ref={slide2Ref}
        slide3Ref={slide3Ref}
        currentSlide={currentSlide}
        telegramConfig={telegramConfig}
        onOpenSettings={(tab) => {
          setIsExportOpen(false);
          setSettingsInitialTab(tab || 'buffer');
          setIsSettingsOpen(true);
        }}
      />

      {/* Global Toast Notification */}
      {globalToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 999,
            background: globalToast.type === 'success' ? '#064e3b' : globalToast.type === 'error' ? '#7f1d1d' : '#1e1b4b',
            color: '#ffffff',
            border: `1px solid ${globalToast.type === 'success' ? '#10b981' : globalToast.type === 'error' ? '#ef4444' : '#6366f1'}`,
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontSize: '0.88rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <span>{globalToast.message}</span>
        </div>
      )}
    </div>
  );
};
