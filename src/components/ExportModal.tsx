import React, { useState, useEffect, useRef } from 'react';
import { RecipeData, TelegramConfig, BufferConfig } from '../types';
import { 
  downloadSlideAsPng, 
  downloadAllSlidesZip, 
  copySlideImageToClipboard, 
  createSlideshowVideo,
  captureSlideAsBlob
} from '../utils/exporter';
import { sendSlideshowToTelegram } from '../utils/telegram';
import { schedulePostToBuffer, fetchBufferProfiles } from '../utils/buffer';
import { generateBothSocialCaptions, generateLocalSocialCaption } from '../utils/geminiCaption';
import confetti from 'canvas-confetti';
import { 
  X, 
  Download, 
  Film, 
  Copy, 
  Send, 
  Archive, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  RefreshCw, 
  Share2, 
  Calendar, 
  AlertCircle,
  Check
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: RecipeData;
  slide1Ref: React.RefObject<HTMLDivElement>;
  slide2Ref: React.RefObject<HTMLDivElement>;
  slide3Ref: React.RefObject<HTMLDivElement>;
  currentSlide: number;
  telegramConfig: TelegramConfig;
  onOpenSettings: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  recipe,
  slide1Ref,
  slide2Ref,
  slide3Ref,
  telegramConfig,
  onOpenSettings
}) => {
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<{ loading: boolean; message: string; success?: boolean } | null>(null);

  // Buffer Scheduling State
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [bufferConfig, setBufferConfig] = useState<BufferConfig>(() => {
    try {
      const saved = localStorage.getItem('slyde_buffer_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { accessToken: '', selectedProfileIds: [], profiles: [], youtubeAsDraft: true };
  });
  const [youtubeAsDraft, setYoutubeAsDraft] = useState<boolean>(() => bufferConfig.youtubeAsDraft ?? true);
  const [bufferScheduleTime, setBufferScheduleTime] = useState<string>('');
  const [isSchedulingBuffer, setIsSchedulingBuffer] = useState(false);
  const [isRefreshingBuffer, setIsRefreshingBuffer] = useState(false);
  const [bufferStatus, setBufferStatus] = useState<{ loading: boolean; message: string; success?: boolean } | null>(null);

  // Social Caption State (Dual Mode: Long vs Short)
  const [captionMode, setCaptionMode] = useState<'long' | 'short'>('long');
  const [cachedCaptions, setCachedCaptions] = useState<{ long: string; short: string }>({ long: '', short: '' });
  const [socialCaption, setSocialCaption] = useState<string>('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isCaptionCopied, setIsCaptionCopied] = useState(false);

  // Initialize or generate caption and auto-refresh Buffer channels when modal opens
  useEffect(() => {
    if (isOpen && recipe) {
      const apiKey = localStorage.getItem('slyde_gemini_api_key') || '';
      setIsGeneratingCaption(true);
      generateBothSocialCaptions(recipe, apiKey)
        .then(both => {
          setCachedCaptions({ long: both.long, short: both.short });
          setSocialCaption(captionMode === 'short' ? both.short : both.long);
        })
        .catch(() => {
          const longFallback = generateLocalSocialCaption(recipe, 'long');
          const shortFallback = generateLocalSocialCaption(recipe, 'short');
          setCachedCaptions({ long: longFallback, short: shortFallback });
          setSocialCaption(captionMode === 'short' ? shortFallback : longFallback);
        })
        .finally(() => {
          setIsGeneratingCaption(false);
        });

      // Auto-sync active channels from Buffer live API
      if (bufferConfig.accessToken) {
        fetchBufferProfiles(bufferConfig.accessToken)
          .then(res => {
            if (res.success && res.profiles && res.profiles.length > 0) {
              setBufferConfig(prev => {
                const validProfileIds = new Set(res.profiles!.map(p => p.id));
                const preservedSelected = (prev.selectedProfileIds || []).filter(id => validProfileIds.has(id));
                const updated = {
                  ...prev,
                  profiles: res.profiles,
                  selectedProfileIds: preservedSelected.length > 0 ? preservedSelected : res.profiles!.map(p => p.id)
                };
                localStorage.setItem('slyde_buffer_config', JSON.stringify(updated));
                return updated;
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, recipe]);

  if (!isOpen) return null;

  const getSlideElements = (): HTMLElement[] => {
    return [
      slide1Ref.current,
      slide2Ref.current,
      slide3Ref.current
    ].filter(Boolean) as HTMLElement[];
  };

  // Download single slide
  const handleDownloadSlide = async (index: number) => {
    const elements = getSlideElements();
    if (!elements[index]) return;

    const names = ['hook-hero', 'recipe-card', 'cta-conversion'];
    const slug = recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await downloadSlideAsPng(elements[index], `${slug}-slide-${index + 1}-${names[index]}`);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
  };

  // Copy slide image to clipboard
  const handleCopyClipboard = async (index: number) => {
    const elements = getSlideElements();
    if (!elements[index]) return;

    const ok = await copySlideImageToClipboard(elements[index]);
    if (ok) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2500);
    }
  };

  // Download ZIP
  const handleDownloadZip = async () => {
    const elements = getSlideElements();
    if (elements.length < 3) return;

    setIsExportingZip(true);
    setZipProgress(10);
    try {
      const slug = recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await downloadAllSlidesZip(elements, slug, (p: number) => setZipProgress(p));
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    } catch (e) {
      console.error('Export ZIP error', e);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Export MP4 Video
  const handleExportVideo = async () => {
    const elements = getSlideElements();
    if (elements.length < 3) return;

    setIsExportingVideo(true);
    setVideoProgress(5);
    try {
      const blob = await createSlideshowVideo(elements, [2.5, 5.0, 1.5], (p: number) => setVideoProgress(p));
      const url = URL.createObjectURL(blob);
      setGeneratedVideoUrl(url);
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
    } catch (e) {
      console.error('Video generation error', e);
    } finally {
      setIsExportingVideo(false);
    }
  };

  // Send to Telegram
  const handleSendTelegram = async () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      onOpenSettings();
      return;
    }

    const elements = getSlideElements();
    if (elements.length < 3) return;

    setTelegramStatus({ loading: true, message: 'Rendering high-resolution slides...' });
    try {
      const blobs: Blob[] = [];
      for (const el of elements) {
        blobs.push(await captureSlideAsBlob(el, 2));
      }
      const res = await sendSlideshowToTelegram(telegramConfig, blobs, recipe, (msg) => {
        setTelegramStatus({ loading: true, message: msg });
      });

      setTelegramStatus({ loading: false, message: res.message, success: res.success });
      if (res.success) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      setTelegramStatus({ loading: false, message: err.message, success: false });
    }
  };

  const handleRefreshBufferChannels = async () => {
    if (!bufferConfig.accessToken) {
      onOpenSettings();
      return;
    }
    setIsRefreshingBuffer(true);
    setBufferStatus({ loading: true, message: 'Syncing live channels from Buffer...' });
    try {
      const res = await fetchBufferProfiles(bufferConfig.accessToken);
      if (res.success && res.profiles) {
        const validProfileIds = new Set(res.profiles.map(p => p.id));
        const preservedSelected = (bufferConfig.selectedProfileIds || []).filter(id => validProfileIds.has(id));
        const updated = {
          ...bufferConfig,
          profiles: res.profiles,
          selectedProfileIds: preservedSelected.length > 0 ? preservedSelected : res.profiles.map(p => p.id)
        };
        setBufferConfig(updated);
        localStorage.setItem('slyde_buffer_config', JSON.stringify(updated));
        fetch('/api/save-buffer-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        }).catch(() => {});
        setBufferStatus({ loading: false, message: `✨ Synced ${res.profiles.length} active channel(s) from Buffer!`, success: true });
      } else {
        setBufferStatus({ loading: false, message: res.message || 'Could not fetch channels from Buffer', success: false });
      }
    } catch (err: any) {
      setBufferStatus({ loading: false, message: 'Network error refreshing channels', success: false });
    } finally {
      setIsRefreshingBuffer(false);
    }
  };

  const handleToggleBufferProfile = (id: string) => {
    const isSelected = bufferConfig.selectedProfileIds?.includes(id);
    const updatedIds = isSelected 
      ? (bufferConfig.selectedProfileIds || []).filter(pid => pid !== id)
      : [...(bufferConfig.selectedProfileIds || []), id];
    
    const updated = {
      ...bufferConfig,
      selectedProfileIds: updatedIds
    };
    setBufferConfig(updated);
    localStorage.setItem('slyde_buffer_config', JSON.stringify(updated));
    fetch('/api/save-buffer-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(() => {});
  };

  // Schedule to Buffer (supports instant shareNow or scheduled queue)
  const handleScheduleBuffer = async (overrideMode?: 'now' | 'queue') => {
    if (!bufferConfig.accessToken) {
      onOpenSettings();
      return;
    }

    if (!bufferConfig.selectedProfileIds || bufferConfig.selectedProfileIds.length === 0) {
      setBufferStatus({ loading: false, message: 'Please select at least 1 account to schedule to.', success: false });
      return;
    }

    setIsSchedulingBuffer(true);
    setBufferStatus({ loading: true, message: 'Preparing high-resolution slides for Buffer...' });

    try {
      const elements = getSlideElements();
      const slidePublicUrls: string[] = [];
      const slideDataUrls: string[] = [];

      const uploadBlobToPublicHost = async (blob: Blob, filename: string): Promise<string | null> => {
        // Upload directly from browser to Litterbox (CORS allowed: access-control-allow-origin: *)
        // This avoids Vercel's 4.5MB serverless body limit which silently truncates large payloads
        try {
          const formData = new FormData();
          formData.append('reqtype', 'fileupload');
          formData.append('time', '72h');
          formData.append('fileToUpload', blob, filename);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const url = (await res.text()).trim();
          if (url && url.startsWith('http')) {
            console.log(`[Slyde] Uploaded ${filename} (${(blob.size / 1024).toFixed(1)}KB) → ${url}`);
            return url;
          }
          console.warn(`[Slyde] Litterbox returned non-URL for ${filename}:`, url);
        } catch (e) {
          console.warn(`[Slyde] Direct Litterbox upload failed for ${filename}:`, e);
        }

        // Fallback: upload via our own serverless endpoint (works for smaller files < 4.5MB)
        try {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          const res = await fetch('/api/upload-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl, filename })
          });
          const json = await res.json();
          if (json?.success && json?.url) {
            console.log(`[Slyde] Fallback uploaded ${filename} → ${json.url}`);
            return json.url;
          }
          console.warn(`[Slyde] Fallback upload failed for ${filename}:`, json);
        } catch (e) {
          console.warn(`[Slyde] Fallback upload error for ${filename}:`, e);
        }
        return null;
      };

      if (elements.length > 0) {
        for (let i = 0; i < elements.length; i++) {
          setBufferStatus({ loading: true, message: `Rendering & preparing Slide ${i + 1}/${elements.length}...` });
          const blob = await captureSlideAsBlob(elements[i], 1.5);
          
          const pubUrl = await uploadBlobToPublicHost(blob, `slide-${i + 1}.png`);
          if (pubUrl) {
            slidePublicUrls.push(pubUrl);
          }

          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          slideDataUrls.push(dataUrl);
        }
      }

      const hasYouTube = bufferConfig.profiles?.some(
        p => p.service.toLowerCase().includes('youtube') && bufferConfig.selectedProfileIds?.includes(p.id)
      );

      let videoPublicUrl: string | undefined = undefined;
      if (hasYouTube && elements.length > 0) {
        setBufferStatus({ loading: true, message: 'Rendering 60 FPS YouTube Shorts video...' });
        const videoBlob = await createSlideshowVideo(elements, [2.5, 5.0, 1.5]);
        const videoExt = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
        console.log(`[Slyde] Video blob: ${(videoBlob.size / (1024 * 1024)).toFixed(2)}MB, type=${videoBlob.type}`);
        setBufferStatus({ loading: true, message: 'Uploading video for YouTube Studio...' });
        videoPublicUrl = (await uploadBlobToPublicHost(videoBlob, `recipe-video.${videoExt}`)) || undefined;
        console.log(`[Slyde] Video public URL: ${videoPublicUrl || 'FAILED'}`);
      }

      setBufferStatus({ loading: true, message: `Dispatching across ${bufferConfig.selectedProfileIds.length} channel(s)...` });
      console.log(`[Slyde] Slide public URLs (${slidePublicUrls.length}):`, slidePublicUrls);
      console.log(`[Slyde] Slide data URLs (${slideDataUrls.length}):`, slideDataUrls.map(u => u.substring(0, 60) + '...'));
      console.log(`[Slyde] Video public URL:`, videoPublicUrl || 'NONE');

      let isoScheduledAt: string | undefined = undefined;
      if (bufferScheduleTime && overrideMode !== 'now') {
        const localDate = new Date(bufferScheduleTime);
        if (!isNaN(localDate.getTime())) {
          isoScheduledAt = localDate.toISOString();
        }
      }

      const finalMediaUrls = slidePublicUrls.length > 0 ? slidePublicUrls : (slideDataUrls.length > 0 ? slideDataUrls : undefined);
      console.log(`[Slyde] Sending to Buffer: mediaUrls=${finalMediaUrls?.length || 0} items, videoUrl=${videoPublicUrl ? 'YES' : 'NO'}`);

      const res = await schedulePostToBuffer(
        bufferConfig,
        socialCaption,
        slidePublicUrls[0] || slideDataUrls[0] || recipe.heroImage,
        isoScheduledAt,
        recipe.title,
        finalMediaUrls,
        cachedCaptions.short,
        cachedCaptions.long,
        overrideMode,
        videoPublicUrl
      );

      setBufferStatus({ loading: false, message: res.message, success: res.success });
      if (res.success) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      setBufferStatus({ loading: false, message: err.message || 'Buffer failed', success: false });
    } finally {
      setIsSchedulingBuffer(false);
    }
  };

  // Regenerate Social Caption with Gemini
  const handleRegenerateCaption = async () => {
    const apiKey = localStorage.getItem('slyde_gemini_api_key') || '';
    setIsGeneratingCaption(true);
    try {
      const both = await generateBothSocialCaptions(recipe, apiKey);
      setCachedCaptions({ long: both.long, short: both.short });
      setSocialCaption(captionMode === 'short' ? both.short : both.long);
    } catch (e) {
      const longFallback = generateLocalSocialCaption(recipe, 'long');
      const shortFallback = generateLocalSocialCaption(recipe, 'short');
      setCachedCaptions({ long: longFallback, short: shortFallback });
      setSocialCaption(captionMode === 'short' ? shortFallback : longFallback);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  // Switch between Long & Short Caption variants
  const handleSwitchCaptionMode = (newMode: 'long' | 'short') => {
    // Preserve any manual edits made in the current mode
    setCachedCaptions(prev => ({
      ...prev,
      [captionMode]: socialCaption
    }));
    setCaptionMode(newMode);
    setSocialCaption(cachedCaptions[newMode] || (newMode === 'short' ? generateLocalSocialCaption(recipe, 'short') : generateLocalSocialCaption(recipe, 'long')));
  };

  // Copy Social Caption to Clipboard
  const handleCopyCaption = () => {
    if (!socialCaption) return;
    navigator.clipboard.writeText(socialCaption);
    setIsCaptionCopied(true);
    setTimeout(() => setIsCaptionCopied(false), 2500);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
  };

  const selectedBufferProfileCount = bufferConfig.selectedProfileIds?.length || 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 980, width: '94vw' }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Download size={20} color="var(--app-primary)" />
            <span>Export Slides, AI Caption & Buffer Scheduler</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Spacious 2-Column Layout */}
        <div className="modal-body" style={{ padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>
            
            {/* LEFT COLUMN: AI Social Media Caption */}
            <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--app-border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.90rem', color: '#ffffff' }}>
                  <Sparkles size={16} color="var(--app-primary)" />
                  <span>AI Social Caption</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    onClick={handleRegenerateCaption}
                    disabled={isGeneratingCaption}
                    title="Regenerate with Gemini API"
                  >
                    <RefreshCw size={13} className={isGeneratingCaption ? 'animate-spin' : ''} />
                    <span>{isGeneratingCaption ? 'Generating...' : 'Regenerate'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '5px 14px', fontSize: '0.75rem' }}
                    onClick={handleCopyCaption}
                  >
                    {isCaptionCopied ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Caption</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Segmented Control for Caption Length */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'rgba(0,0,0,0.35)', padding: 3, borderRadius: 'var(--radius-sm)', border: '1px solid var(--app-border)' }}>
                <button
                  type="button"
                  onClick={() => handleSwitchCaptionMode('long')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: captionMode === 'long' ? 'var(--app-primary)' : 'transparent',
                    color: captionMode === 'long' ? '#121216' : 'var(--app-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5
                  }}
                >
                  <span>Full Recipe (Long)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchCaptionMode('short')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: captionMode === 'short' ? 'var(--app-primary)' : 'transparent',
                    color: captionMode === 'short' ? '#121216' : 'var(--app-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5
                  }}
                >
                  <span>Short & Punchy (TikTok / Compact)</span>
                </button>
              </div>

              <textarea
                className="form-textarea"
                style={{ 
                  flex: 1, 
                  minHeight: '400px',
                  fontSize: '0.78rem', 
                  lineHeight: 1.45, 
                  fontFamily: 'var(--font-mono)',
                  resize: 'none'
                }}
                value={socialCaption}
                onChange={(e) => setSocialCaption(e.target.value)}
                placeholder="Generating viral recipe caption..."
              />
            </div>

            {/* RIGHT COLUMN: Export Downloads, Buffer & Telegram */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* 1. Schedule with Buffer */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Share2 size={16} color="var(--app-primary)" />
                    <span>Schedule to Buffer</span>
                  </div>
                  {bufferConfig.accessToken && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--app-primary)', fontWeight: 700 }}>
                      {selectedBufferProfileCount} channel{selectedBufferProfileCount === 1 ? '' : 's'} active
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.72rem', color: 'var(--app-text-muted)', marginBottom: 10 }}>
                  {bufferConfig.accessToken 
                    ? 'Dispatches the AI caption and recipe media straight into your Buffer queue.' 
                    : 'Connect your Buffer account in Settings to enable automated multi-platform scheduling.'}
                </p>

                {bufferConfig.accessToken ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Account Channel Selector (Single / Multi Select) */}
                    {bufferConfig.profiles && bufferConfig.profiles.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(0, 0, 0, 0.25)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Post to Channels ({bufferConfig.selectedProfileIds?.length || 0}/{bufferConfig.profiles.length}):
                          </span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={handleRefreshBufferChannels}
                              disabled={isRefreshingBuffer}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--app-text-muted)', 
                                fontSize: '0.68rem', 
                                cursor: 'pointer', 
                                fontWeight: 600, 
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                              title="Sync latest connected accounts from Buffer"
                            >
                              <RefreshCw size={10} className={isRefreshingBuffer ? 'animate-spin' : ''} />
                              <span>{isRefreshingBuffer ? 'Syncing...' : 'Sync'}</span>
                            </button>
                            <span style={{ color: 'var(--app-border)', fontSize: '0.65rem' }}>·</span>
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = bufferConfig.profiles!.map(p => p.id);
                                const updated = { ...bufferConfig, selectedProfileIds: allIds };
                                setBufferConfig(updated);
                                localStorage.setItem('slyde_buffer_config', JSON.stringify(updated));
                                fetch('/api/save-buffer-config', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(updated)
                                }).catch(() => {});
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--app-primary)', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                            >
                              All
                            </button>
                            <span style={{ color: 'var(--app-border)', fontSize: '0.65rem' }}>·</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...bufferConfig, selectedProfileIds: [] };
                                setBufferConfig(updated);
                                localStorage.setItem('slyde_buffer_config', JSON.stringify(updated));
                                fetch('/api/save-buffer-config', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(updated)
                                }).catch(() => {});
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--app-text-muted)', fontSize: '0.68rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                            >
                              None
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {bufferConfig.profiles.map(p => {
                            const isSelected = bufferConfig.selectedProfileIds?.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleToggleBufferProfile(p.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '3px 8px 3px 5px',
                                  borderRadius: 'var(--radius-full)',
                                  background: isSelected ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                                  border: `1px solid ${isSelected ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                  color: isSelected ? '#ffffff' : 'var(--app-text-muted)',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  transition: 'all 0.15s ease'
                                }}
                                title={`${isSelected ? 'Selected' : 'Click to select'}: ${p.formatted_username} (${p.service})`}
                              >
                                {p.avatar ? (
                                  <img src={p.avatar} alt={p.formatted_username} style={{ width: 16, height: 16, borderRadius: '50%' }} />
                                ) : (
                                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.60rem', fontWeight: 800 }}>
                                    {p.service[0].toUpperCase()}
                                  </span>
                                )}
                                <span>{p.formatted_username}</span>
                                <span style={{ fontSize: '0.62rem', opacity: 0.65, textTransform: 'capitalize' }}>({p.service})</span>
                                {isSelected && <Check size={11} color="var(--app-primary)" strokeWidth={3} />}
                              </button>
                            );
                          })}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', color: 'var(--app-primary)', opacity: 0.9, marginTop: 2, padding: '2px 4px' }}>
                          <Sparkles size={11} />
                          <span><strong>Smart Length:</strong> Auto-formats short punchy caption for X & Pinterest · full recipe for TikTok & IG.</span>
                        </div>

                        {/* YouTube Private Draft Toggle */}
                        {bufferConfig.profiles?.some(p => p.service.toLowerCase().includes('youtube') && bufferConfig.selectedProfileIds?.includes(p.id)) && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 10px',
                            marginTop: 4
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="#ef4444">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                              </svg>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffffff' }}>
                                  Post to YouTube as Private Draft
                                </span>
                                <span style={{ fontSize: '0.64rem', color: 'var(--app-text-muted)' }}>
                                  Uploads as a private draft so you can add trending audio/music in YouTube Studio.
                                </span>
                              </div>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: 2 }}>
                              <input
                                type="checkbox"
                                checked={youtubeAsDraft}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setYoutubeAsDraft(val);
                                  const updated = { ...bufferConfig, youtubeAsDraft: val };
                                  setBufferConfig(updated);
                                  localStorage.setItem('slyde_buffer_config', JSON.stringify(updated));
                                }}
                                style={{ cursor: 'pointer', accentColor: 'var(--app-primary)', width: 15, height: 15 }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          ref={datePickerRef}
                          type="datetime-local"
                          className="form-input"
                          style={{ 
                            width: '100%',
                            padding: '7px 10px', 
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            colorScheme: 'dark'
                          }}
                          value={bufferScheduleTime}
                          onChange={(e) => setBufferScheduleTime(e.target.value)}
                          onClick={() => {
                            try {
                              (datePickerRef.current as any)?.showPicker?.();
                            } catch (e) {}
                          }}
                          title="Click to select scheduled date and time"
                        />
                        {bufferScheduleTime && (
                          <button
                            type="button"
                            onClick={() => setBufferScheduleTime('')}
                            style={{
                              position: 'absolute',
                              right: 28,
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--app-text-muted)',
                              cursor: 'pointer',
                              padding: 2,
                              fontSize: '0.70rem'
                            }}
                            title="Clear date (switch to Queue mode)"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '7px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                          onClick={() => handleScheduleBuffer()}
                          disabled={isSchedulingBuffer}
                        >
                          {isSchedulingBuffer ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Calendar size={13} />
                              <span>{bufferScheduleTime ? 'Schedule Post' : 'Add to Queue'}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ 
                            padding: '7px 10px', 
                            fontSize: '0.76rem', 
                            whiteSpace: 'nowrap',
                            background: 'rgba(245, 158, 11, 0.12)',
                            borderColor: 'rgba(245, 158, 11, 0.35)',
                            color: 'var(--app-primary)'
                          }}
                          onClick={() => handleScheduleBuffer('now')}
                          disabled={isSchedulingBuffer}
                          title="Publish instantly right now across selected channels"
                        >
                          <Sparkles size={12} />
                          <span>Share Now</span>
                        </button>
                      </div>
                    </div>

                    {bufferStatus && (
                      <div
                        className={`extraction-status-banner ${bufferStatus.success === undefined ? 'loading' : bufferStatus.success ? 'success' : 'error'}`}
                        style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                      >
                        {bufferStatus.success ? <CheckCircle2 size={13} color="#10b981" /> : <AlertCircle size={13} color="#ef4444" />}
                        <span>{bufferStatus.message}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: '100%', padding: '6px 12px', fontSize: '0.78rem', justifyContent: 'center' }}
                    onClick={onOpenSettings}
                  >
                    <span>Connect Buffer Account</span>
                  </button>
                )}
              </div>

              {/* 2. Bulk Packs (ZIP & MP4) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#0a0a0d', border: '1px solid var(--app-border)', borderRadius: 'var(--radius-md)', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Archive size={14} color="var(--app-primary)" />
                      <span>3-Slide ZIP Pack</span>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--app-text-dim)', marginTop: 2 }}>
                      All PNG slides in 1 archive.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: '100%', marginTop: 6, padding: '6px 10px', fontSize: '0.75rem', justifyContent: 'center' }}
                    onClick={handleDownloadZip}
                    disabled={isExportingZip}
                  >
                    {isExportingZip ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Zipping {zipProgress}%...</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} />
                        <span>Download ZIP</span>
                      </>
                    )}
                  </button>
                </div>

                <div style={{ background: '#0a0a0d', border: '1px solid var(--app-border)', borderRadius: 'var(--radius-md)', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Film size={14} color="var(--app-accent)" />
                      <span>Slideshow MP4</span>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--app-text-dim)', marginTop: 2 }}>
                      Video for Reels & Shorts.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: '100%', marginTop: 6, padding: '6px 10px', fontSize: '0.75rem', justifyContent: 'center' }}
                    onClick={handleExportVideo}
                    disabled={isExportingVideo}
                  >
                    {isExportingVideo ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Rendering {videoProgress}%...</span>
                      </>
                    ) : (
                      <>
                        <Film size={13} />
                        <span>Generate MP4</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Video Player if generated */}
              {generatedVideoUrl && (
                <div style={{ background: '#000', border: '1px solid var(--app-border)', borderRadius: 'var(--radius-md)', padding: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--app-success)' }}>✓ MP4 Ready</span>
                    <a
                      href={generatedVideoUrl}
                      download={`${recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-video.mp4`}
                      className="btn-primary"
                      style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                    >
                      <Download size={11} /> Download
                    </a>
                  </div>
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    style={{ width: '100%', maxHeight: '130px', borderRadius: 6, background: '#000' }}
                  />
                </div>
              )}

              {/* 3. Individual Slide PNG Downloads & Copy */}
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--app-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Individual Slide Downloads (1080x1920)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    { title: 'Slide 1: Hero Hook & Title', desc: 'Hero photo & macros' },
                    { title: 'Slide 2: Recipe & Method', desc: 'Ingredients & steps' },
                    { title: 'Slide 3: Brand CTA', desc: '4 value perks & link' }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#0a0a0d',
                        border: '1px solid var(--app-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 22, height: 22, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.72rem' }}>
                          {idx + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>{item.title}</div>
                          <div style={{ fontSize: '0.66rem', color: 'var(--app-text-dim)' }}>{item.desc}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => handleCopyClipboard(idx)}
                        >
                          {copiedIndex === idx ? (
                            <>
                              <CheckCircle2 size={11} color="var(--app-success)" />
                              <span style={{ color: 'var(--app-success)' }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => handleDownloadSlide(idx)}
                        >
                          <Download size={11} />
                          <span>PNG</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Send to Telegram directly */}
              <div style={{ background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.18)', borderRadius: 'var(--radius-md)', padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.80rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Send size={13} color="var(--app-primary)" />
                      <span>Direct Telegram Publishing</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--app-text-muted)', marginTop: 1 }}>
                      {telegramConfig.botToken && telegramConfig.chatId ? (
                        <span>Ready to post album to {telegramConfig.chatId}</span>
                      ) : (
                        <span>Configure Bot in Settings to enable 1-click send.</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                    onClick={handleSendTelegram}
                    disabled={telegramStatus?.loading}
                  >
                    {telegramStatus?.loading ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        <span>Publish</span>
                      </>
                    )}
                  </button>
                </div>

                {telegramStatus && (
                  <div
                    className={`extraction-status-banner ${telegramStatus.success === undefined ? 'loading' : telegramStatus.success ? 'success' : 'error'}`}
                    style={{ marginTop: 6, padding: '4px 8px', fontSize: '0.70rem' }}
                  >
                    {telegramStatus.success ? (
                      <CheckCircle2 size={12} color="#10b981" />
                    ) : (
                      <Loader2 size={12} className={telegramStatus.loading ? 'animate-spin' : ''} />
                    )}
                    <span>{telegramStatus.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '10px 22px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
