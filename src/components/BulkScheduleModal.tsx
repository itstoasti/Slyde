import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  List,
  Layers,
  ShieldCheck,
  RefreshCw,
  Plus
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AUDIO_VIBE_PRESETS, AudioVibeOption, getPreferredAudioVibe, setPreferredAudioVibe } from '../utils/audioManager';
import { BufferConfig } from '../types';

interface BulkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: (tab?: 'buffer' | 'ai' | 'telegram' | 'autopilot') => void;
}

interface BufferQueueStatus {
  totalScheduled: number;
  slotsAvailable: number;
  latestDueAt: string | null;
  scheduledPosts: any[];
}

interface ReserveQueueStatus {
  totalCount: number;
  pendingCount: number;
  scheduledCount: number;
  pendingRecipes: any[];
  allRecipes: any[];
}

export const BulkScheduleModal: React.FC<BulkScheduleModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings
}) => {
  const [urlsText, setUrlsText] = useState('');
  const [preferredTime, setPreferredTime] = useState('11:30');
  const [musicVibe, setMusicVibe] = useState<'lofi' | 'acoustic' | 'upbeat' | 'auto' | 'none'>(() => getPreferredAudioVibe());

  // Buffer state
  const [bufferConfig, setBufferConfig] = useState<BufferConfig>(() => {
    try {
      const saved = localStorage.getItem('slyde_buffer_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { accessToken: '', selectedProfileIds: [], profiles: [] };
  });

  // Navigation tab: 'schedule' | 'buffer' | 'reserve'
  const [activeTab, setActiveTab] = useState<'schedule' | 'buffer' | 'reserve'>('schedule');

  // Live status states
  const [bufferStatus, setBufferStatus] = useState<BufferQueueStatus>({
    totalScheduled: 0,
    slotsAvailable: 10,
    latestDueAt: null,
    scheduledPosts: []
  });
  const [reserveStatus, setReserveStatus] = useState<ReserveQueueStatus>({
    totalCount: 0,
    pendingCount: 0,
    scheduledCount: 0,
    pendingRecipes: [],
    allRecipes: []
  });
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultStatus, setResultStatus] = useState<{ success: boolean; message: string } | null>(null);

  const fetchQueueStatus = async (token?: string) => {
    const activeToken = token || bufferConfig.accessToken || '';
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/buffer-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_queue_status',
          token: activeToken
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.buffer) {
          setBufferStatus({
            totalScheduled: data.buffer.totalScheduled || 0,
            slotsAvailable: data.buffer.slotsAvailable ?? 10,
            latestDueAt: data.buffer.latestDueAt || null,
            scheduledPosts: data.buffer.scheduledPosts || []
          });
        }
        if (data.reserve) {
          setReserveStatus({
            totalCount: data.reserve.totalCount || 0,
            pendingCount: data.reserve.pendingCount || 0,
            scheduledCount: data.reserve.scheduledCount || 0,
            pendingRecipes: data.reserve.pendingRecipes || [],
            allRecipes: data.reserve.allRecipes || []
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch queue status:', e);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Reload buffer config from localStorage
      let currentToken = '';
      try {
        const saved = localStorage.getItem('slyde_buffer_config');
        if (saved) {
          const parsed = JSON.parse(saved);
          setBufferConfig(parsed);
          currentToken = parsed.accessToken || '';
        }
      } catch (e) {}

      fetchQueueStatus(currentToken);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedUrls = Array.from(
    new Set(
      urlsText
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.startsWith('http'))
    )
  );

  const hasBufferToken = Boolean(bufferConfig.accessToken?.trim());

  // 1. Add links to reserve & auto-fill Buffer up to 10
  const handleAddToReserveAndTopUp = async () => {
    if (parsedUrls.length === 0) return;

    setIsProcessing(true);
    setResultStatus(null);
    setProgressMsg(`Adding ${parsedUrls.length} recipe(s) to reserve & auto-filling Buffer...`);

    try {
      const res = await fetch('/api/buffer-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_to_reserve',
          token: bufferConfig.accessToken,
          urls: parsedUrls,
          autoTopUp: true
        })
      });

      const data = await res.json();

      if (data.success) {
        const scheduledCount = data.topUpResult?.scheduledCount || 0;
        const totalScheduled = data.buffer?.totalScheduled || (bufferStatus.totalScheduled + scheduledCount);
        const remaining = data.reserve?.pendingCount ?? Math.max(0, parsedUrls.length - scheduledCount);

        setResultStatus({
          success: true,
          message: `🎉 Added ${data.added?.addedCount || parsedUrls.length} recipe(s) to reserve! ${
            scheduledCount > 0 
              ? `Scheduled ${scheduledCount} directly into Buffer (${totalScheduled}/10 full).` 
              : 'Buffer is currently full.'
          } ${remaining} recipe(s) waiting in reserve.`
        });
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        setUrlsText('');
        await fetchQueueStatus();
      } else {
        setResultStatus({
          success: false,
          message: data.message || 'Failed to update reserve queue.'
        });
      }
    } catch (e: any) {
      setResultStatus({
        success: false,
        message: e.message || 'Network error updating reserve queue.'
      });
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // 2. Trigger instant top-up
  const handleTopUpNow = async () => {
    setIsProcessing(true);
    setResultStatus(null);
    setProgressMsg('Checking Buffer queue and refilling open slots from reserve...');

    try {
      const res = await fetch('/api/buffer-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'top_up_queue',
          token: bufferConfig.accessToken
        })
      });

      const data = await res.json();
      if (data.success) {
        const scheduled = data.result?.scheduledCount || 0;
        setResultStatus({
          success: true,
          message: data.result?.message || `Scheduled ${scheduled} posts to Buffer!`
        });
        if (scheduled > 0) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        await fetchQueueStatus();
      } else {
        setResultStatus({
          success: false,
          message: data.result?.message || data.message || 'Top-up failed.'
        });
      }
    } catch (e: any) {
      setResultStatus({
        success: false,
        message: e.message || 'Network error topping up Buffer.'
      });
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const bufferPercentage = Math.min(100, Math.round((bufferStatus.totalScheduled / 10) * 100));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
            }}>
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                Monthly Recipe Loader & Buffer Autopilot
              </h2>
              <p style={{ fontSize: '0.80rem', color: 'var(--app-text-muted)', margin: 0 }}>
                Load 15–30 recipes 1–2x a month. Slyde holds them in reserve and perpetually keeps Buffer's 10-post queue filled.
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Live Queue Health Dashboard Header */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--app-border)',
          padding: '14px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          {/* Buffer Capacity Meter */}
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                <ShieldCheck size={16} color={bufferStatus.totalScheduled >= 10 ? '#10b981' : 'var(--app-primary)'} />
                <span>Buffer Active Queue:</span>
                <span style={{ color: bufferStatus.totalScheduled >= 10 ? '#10b981' : 'var(--app-primary)' }}>
                  {bufferStatus.totalScheduled} / 10 Posts
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--app-text-muted)', fontWeight: 500 }}>
                  ({bufferStatus.slotsAvailable} open slot{bufferStatus.slotsAvailable === 1 ? '' : 's'})
                </span>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => fetchQueueStatus()}
                disabled={isLoadingStatus}
                title="Refresh live status"
                style={{ width: 24, height: 24 }}
              >
                <RefreshCw size={13} className={isLoadingStatus ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${bufferPercentage}%`,
                height: '100%',
                background: bufferPercentage >= 100 
                  ? 'linear-gradient(90deg, #10b981, #059669)' 
                  : 'linear-gradient(90deg, var(--app-primary), #ef4444)',
                borderRadius: 3,
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>

          {/* Reserve Inventory Counter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--app-border)'
          }}>
            <Layers size={18} color="#3b82f6" />
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Reserve Inventory
              </div>
              <div style={{ fontSize: '0.90rem', fontWeight: 800, color: '#fff' }}>
                {reserveStatus.pendingCount} Recipes Ready
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--app-border)', padding: '0 24px' }}>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}
          >
            <Sparkles size={16} />
            <span>Load Monthly Recipes</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'buffer' ? 'active' : ''}`}
            onClick={() => setActiveTab('buffer')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}
          >
            <Calendar size={16} />
            <span>Buffer Active Posts ({bufferStatus.scheduledPosts.length})</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'reserve' ? 'active' : ''}`}
            onClick={() => setActiveTab('reserve')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}
          >
            <List size={16} />
            <span>Reserve Inventory ({reserveStatus.pendingRecipes.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              {/* Buffer Warning Banner if not connected */}
              {!hasBufferToken && (
                <div className="extraction-status-banner error" style={{ padding: '12px 16px' }}>
                  <AlertCircle size={18} color="#ef4444" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>Buffer Not Connected</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--app-text-muted)', marginTop: 2 }}>
                      Connect Buffer in Settings to schedule posts directly to TikTok, Instagram, and Threads.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', height: 'auto' }}
                    onClick={() => { onClose(); onOpenSettings('buffer'); }}
                  >
                    Connect Buffer
                  </button>
                </div>
              )}

              {/* Autopilot Explanation Box */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(239, 68, 68, 0.05) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12
              }}>
                <ShieldCheck size={20} color="var(--app-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 800, color: '#fff' }}>Guaranteed Direct Automated Publishing:</span>{' '}
                  <span style={{ color: 'var(--app-text-muted)' }}>
                    All posts are scheduled directly via Buffer API with <code>schedulingType: "automatic"</code>.
                    They will publish automatically with complete viral captions (ingredients, numbered steps, hashtags) and 60 FPS Lo-Fi videos.
                    <b>No reminders or manual phone pushes!</b>
                  </span>
                </div>
              </div>

              {/* 1. URL List Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                    Paste Recipe URLs ({parsedUrls.length} links ready)
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)' }}>
                    Paste 15 – 30 URLs (one per line) 1–2x a month
                  </span>
                </div>
                <textarea
                  className="form-textarea"
                  rows={6}
                  placeholder={`https://www.allrecipes.com/recipe/22728/hot-fudge-ice-cream-bar-dessert/\nhttps://www.allrecipes.com/recipe/21442/crispy-rangoon/\nhttps://www.foodnetwork.com/recipes/...`}
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.5 }}
                />
              </div>

              {/* 2. Timing & Music Settings */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--app-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.90rem', color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color="var(--app-primary)" />
                  <span>Autopilot Schedule & Music Preferences</span>
                </div>

                <div className="form-row" style={{ gap: 14 }}>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">Daily Post Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                    />
                    <span style={{ fontSize: '0.70rem', color: 'var(--app-text-muted)', marginTop: 4, display: 'block' }}>
                      Posts will be queued 1 per day at this preferred time.
                    </span>
                  </div>

                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">Background Music Vibe</label>
                    <select
                      className="form-select"
                      value={musicVibe}
                      onChange={(e) => {
                        const v = e.target.value as any;
                        setMusicVibe(v);
                        setPreferredAudioVibe(v);
                      }}
                    >
                      {AUDIO_VIBE_PRESETS.map((p: AudioVibeOption) => (
                        <option key={p.id} value={p.id}>
                          {p.emoji} {p.name}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.70rem', color: 'var(--app-text-muted)', marginTop: 4, display: 'block' }}>
                      Embedded into 60 FPS 9:16 vertical video for TikTok & Shorts.
                    </span>
                  </div>
                </div>
              </div>

              {/* Processing Progress */}
              {isProcessing && (
                <div className="extraction-status-banner loading" style={{ padding: '14px 18px' }}>
                  <Loader2 size={18} className="animate-spin" color="var(--app-primary)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.86rem' }}>
                      Autopilot Replenishing Buffer...
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--app-text-muted)', marginTop: 2 }}>
                      {progressMsg}
                    </div>
                  </div>
                </div>
              )}

              {/* Result Status Message */}
              {resultStatus && (
                <div className={`extraction-status-banner ${resultStatus.success ? 'success' : 'error'}`} style={{ padding: '14px 18px' }}>
                  {resultStatus.success ? <CheckCircle2 size={18} color="#10b981" /> : <AlertCircle size={18} color="#ef4444" />}
                  <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{resultStatus.message}</span>
                </div>
              )}

              {/* Action Buttons Row */}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAddToReserveAndTopUp}
                  disabled={isProcessing || parsedUrls.length === 0 || !hasBufferToken}
                  style={{
                    flex: 2,
                    height: 48,
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)'
                  }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      <span>Add {parsedUrls.length > 0 ? parsedUrls.length : ''} to Reserve & Fill Buffer</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleTopUpNow}
                  disabled={isProcessing || bufferStatus.slotsAvailable === 0 || reserveStatus.pendingCount === 0 || !hasBufferToken}
                  style={{
                    flex: 1,
                    height: 48,
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    justifyContent: 'center',
                    gap: 8
                  }}
                  title={bufferStatus.slotsAvailable === 0 ? 'Buffer is full (10/10)' : 'Fill open slots now from reserve'}
                >
                  <Play size={16} />
                  <span>Top Up Buffer Now ({bufferStatus.slotsAvailable} open)</span>
                </button>
              </div>

            </div>
          )}

          {/* Tab 2: Buffer Active Posts */}
          {activeTab === 'buffer' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>
                  Buffer Active Scheduled Posts ({bufferStatus.scheduledPosts.length}/10)
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: 32, padding: '0 10px', fontSize: '0.75rem' }}
                  onClick={() => fetchQueueStatus()}
                  disabled={isLoadingStatus}
                >
                  <RefreshCw size={13} className={isLoadingStatus ? 'animate-spin' : ''} style={{ marginRight: 6 }} />
                  Refresh
                </button>
              </div>

              {isLoadingStatus ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--app-text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                  <div>Querying Buffer API...</div>
                </div>
              ) : bufferStatus.scheduledPosts.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--app-text-muted)', border: '1px dashed var(--app-border)', borderRadius: 'var(--radius-lg)' }}>
                  <Calendar size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>Buffer Queue is Empty</div>
                  <div style={{ fontSize: '0.80rem' }}>
                    Paste links in the "Load Monthly Recipes" tab to schedule up to 10 days of posts automatically.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {bufferStatus.scheduledPosts.map((post: any, idx: number) => (
                    <div
                      key={post.id || idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--app-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, marginRight: 14 }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem' }}>
                          {post.text?.split('\n')[0] || `Scheduled Post #${idx + 1}`}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.72rem', color: 'var(--app-text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} color="var(--app-primary)" />
                            {new Date(post.dueAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                          <span>&bull;</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ShieldCheck size={12} color="#10b981" />
                            Direct Automated Post
                          </span>
                        </div>
                      </div>

                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981'
                      }}>
                        Scheduled
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Reserve Inventory */}
          {activeTab === 'reserve' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>
                  Reserve Inventory ({reserveStatus.pendingRecipes.length} waiting)
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: 32, padding: '0 10px', fontSize: '0.75rem' }}
                  onClick={() => fetchQueueStatus()}
                  disabled={isLoadingStatus}
                >
                  <RefreshCw size={13} className={isLoadingStatus ? 'animate-spin' : ''} style={{ marginRight: 6 }} />
                  Refresh
                </button>
              </div>

              {isLoadingStatus ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--app-text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                  <div>Loading reserve inventory...</div>
                </div>
              ) : reserveStatus.pendingRecipes.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--app-text-muted)', border: '1px dashed var(--app-border)', borderRadius: 'var(--radius-lg)' }}>
                  <Layers size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>Reserve Queue is Empty</div>
                  <div style={{ fontSize: '0.80rem' }}>
                    Load 15–30 recipe links in the "Load Monthly Recipes" tab to build your reserve inventory.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {reserveStatus.pendingRecipes.map((r: any, idx: number) => (
                    <div
                      key={r.id || idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--app-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, marginRight: 14 }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem' }}>
                          {r.title || 'Untitled Recipe'}
                        </div>
                        {r.sourceUrl && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--app-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 450 }}>
                            🔗 {r.sourceUrl}
                          </div>
                        )}
                      </div>

                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa'
                      }}>
                        Ready in Reserve
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--app-border)', padding: '14px 24px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
