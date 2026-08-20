import { BufferConfig, BufferProfile } from '../types';

export interface BufferTestResult {
  success: boolean;
  message: string;
  profiles?: BufferProfile[];
}

export interface BufferScheduleResult {
  success: boolean;
  message: string;
  updateIds?: string[];
}

/**
 * Fetch connected social profiles from Buffer (supports modern GraphQL and legacy REST)
 */
export async function fetchBufferProfiles(accessToken: string): Promise<BufferTestResult> {
  const token = accessToken.trim();
  if (!token) {
    return { success: false, message: 'Please provide a Buffer Access Token.' };
  }

  try {
    const res = await fetch('/api/buffer-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_profiles',
        token
      })
    });

    const data = await res.json();

    if (!data.success && data.message) {
      return {
        success: false,
        message: data.message
      };
    }

    if (Array.isArray(data.profiles) && data.profiles.length > 0) {
      return {
        success: true,
        message: `Connected! Found ${data.profiles.length} active social channel${data.profiles.length === 1 ? '' : 's'}.`,
        profiles: data.profiles
      };
    }

    if (Array.isArray(data.profiles) && data.profiles.length === 0) {
      return {
        success: true,
        message: 'Token verified! (No social channels connected yet in your Buffer account).',
        profiles: []
      };
    }

    return {
      success: false,
      message: data.error || data.message || 'Unable to authenticate with Buffer. Please verify your token.'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Network error connecting to Buffer: ${error.message || 'Check connection'}`
    };
  }
}

/**
 * Schedule a social post with caption and media attachments to Buffer
 * Features platform-aware auto-adaptation (Short for Twitter/Pinterest, Long for TikTok/IG)
 */
export async function schedulePostToBuffer(
  config: BufferConfig,
  caption: string,
  mediaUrl?: string,
  scheduledAt?: string,
  title?: string,
  mediaUrls?: string[],
  shortCaption?: string,
  longCaption?: string
): Promise<BufferScheduleResult> {
  const token = config.accessToken.trim();
  const profileIds = config.selectedProfileIds || [];

  if (!token) {
    return {
      success: false,
      message: 'Buffer Access Token is required. Please set it in Settings.'
    };
  }

  if (profileIds.length === 0) {
    return {
      success: false,
      message: 'Please select at least one connected social profile to schedule.'
    };
  }

  try {
    const res = await fetch('/api/buffer-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_post',
        token,
        profileIds,
        channels: config.profiles || [],
        caption,
        shortCaption,
        longCaption,
        title,
        mediaUrl,
        mediaUrls,
        scheduledAt,
        scheduleMode: config.scheduleMode || 'queue',
        youtubeAsDraft: config.youtubeAsDraft ?? true,
        postAsDraft: config.postAsDraft ?? false
      })
    });

    const result = await res.json();

    if (result.success) {
      return {
        success: true,
        message: scheduledAt 
          ? `Successfully scheduled for ${new Date(scheduledAt).toLocaleString()} across ${profileIds.length} channel(s)!`
          : `Added to Buffer queue across ${profileIds.length} social channel(s)!`
      };
    }

    return {
      success: false,
      message: result.message || 'Buffer update failed to schedule.'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Buffer schedule failed: ${error.message || 'Network error'}`
    };
  }
}
