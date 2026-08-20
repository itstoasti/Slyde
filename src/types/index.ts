export interface Ingredient {
  name: string;
  amount: string;
}

export interface PerkItem {
  id: number;
  title: string;
  desc: string;
}

export type DensityMode = 'auto' | 'spacious' | 'standard' | 'compact' | 'micro';
export type ColumnMode = 'auto' | '1' | '2' | '3';
export type SplitMode = 'auto' | 'balanced' | 'more-ingredients' | 'more-method';
export type CardStyle = 'cream' | 'pure-white' | 'dark-glass' | 'soft-warm';

export interface Slide2LayoutConfig {
  density: DensityMode;
  ingredientColumns: ColumnMode;
  fontScale: number; // 0.75 to 1.25
  splitProportion: SplitMode;
  showThumbnail: boolean;
  cardStyle: CardStyle;
}

export interface RecipeData {
  id: string;
  title: string;
  shortHook: string;
  taglineBadge: string;
  heroImage: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  calories: string;
  proteinCallout?: string;
  highlightBadge?: string;
  ingredients: Ingredient[];
  method: string[];
  brandName: string;
  brandSubtitle: string;
  brandPillBadge: string;
  brandLogo?: string;
  brandLogoSize?: number;
  ctaButtonText: string;
  ctaUrl: string;
  socialHandle: string;
  perks: PerkItem[];
  sourceUrl?: string;
  slide2Config?: Slide2LayoutConfig;
  themeId?: ThemeId;
}

export type ThemeId = 
  | 'caramel' 
  | 'noir' 
  | 'sage' 
  | 'berry' 
  | 'sunset' 
  | 'clean' 
  | 'matcha' 
  | 'terracotta' 
  | 'lavender' 
  | 'cobalt';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  accent: string;
  bgDark: string;
  bgCard: string;
  textDark: string;
  textMuted: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  buttonBg: string;
  buttonText: string;
  buttonGlow: string;
  pillNumberBg: string;
  pillNumberText: string;
}

export type AspectRatio = '9:16' | '4:5';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  includeCaption: boolean;
  sendAsAlbum: boolean;
  inboundListenerEnabled?: boolean;
  messageThreadId?: string | number;
}

export type SocialPlatform = 'tiktok' | 'instagram' | 'none';

export interface SocialOverlaySettings {
  platform: SocialPlatform;
  likes: string;
  comments: string;
  bookmarks: string;
  shares: string;
  soundName: string;
}

export type StudioViewMode = 'phone' | 'storyboard';

export interface AutoPilotConfig {
  enabled: boolean;
  scheduleTime: string; // e.g. "09:00"
  frequency: 'daily' | 'twice-daily' | 'hourly';
  themeRotation: 'rotate' | 'random' | 'fixed';
  urlsQueue: string[];
  autoPublishTelegram: boolean;
  lastRunTimestamp?: number;
  historyLogs: Array<{
    id: string;
    timestamp: number;
    title: string;
    status: 'success' | 'failed';
    theme: string;
    url: string;
  }>;
}

export interface BufferProfile {
  id: string;
  formatted_username: string;
  service: string;
  avatar?: string;
}

export interface BufferConfig {
  accessToken: string;
  selectedProfileIds: string[];
  profiles?: BufferProfile[];
  scheduleMode?: 'queue' | 'custom' | 'now';
  youtubeAsDraft?: boolean;
  postAsDraft?: boolean;
}

export type AIProvider = 'gemini' | 'openrouter';

export interface AIConfig {
  provider: AIProvider;
  geminiApiKey: string;
  geminiModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
}
