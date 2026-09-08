import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Music, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  List
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AUDIO_VIBE_PRESETS, AudioVibeOption } from '../utils/audioManager';
import { BufferConfig, BufferProfile } from '../types';

interface BulkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: (tab?: 'buffer' | 'ai' | 'telegram' | 'autopilot') => void;
}

export const BulkScheduleModal: React.FC<BulkScheduleModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings
}) => {
  const [urlsText, setUrlsText] = useState('');
  const [cadence, setCadence] = useState<'1-daily' | '2-daily'>('1-daily');
  const [preferredTime, setPreferredTime] = useState('11:30');
  const [secondTime, setSecondTime] = useState('17:30');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [musicVibe, setMusicVibe] = useState<'auto' | 'lofi' | 'acoustic' | 'upbeat'>('auto');
  const [instagramFormat, setInstagramFormat] = useState<'carousel' | 'video'>('carousel');

  // Buffer state
  const [bufferConfig, setBufferConfig] = useState<BufferConfig>(() => {
    try {
      const saved = localStorage.getItem('slyde_buffer_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { accessToken: '', selectedProfileIds: [], profiles: [] };
  });

  // Scheduled history
  const [activeTab, setActiveTab] = useState<'schedule' | 'queue'>('schedule');
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultStatus, setResultStatus] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reload buffer config
      try {
        const saved = localStorage.getItem('slyde_buffer_config');
        if (saved) setBufferConfig(JSON.parse(saved));
      } catch (e) {}

      // Fetch existing scheduled posts
      setIsLoadingScheduled(true);
      fetch('/api/batch-schedule')
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.posts)) {
            setScheduledPosts(data.posts);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingScheduled(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedUrls = urlsText
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.startsWith('http'));

  const handleRunBatch = async () => {
    if (parsedUrls.length === 0) return;

    setIsProcessing(true);
    setResultStatus(null);
    setProgressMsg(`Starting automated batch processing for ${parsedUrls.length} recipe(s)...`);

    try {
      const res = await fetch('/api/batch-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: parsedUrls,
          cadence,
          preferredTime,
          secondTime,
          startDate,
          musicVibe,
          instagramFormat
        })
      });

      const data = await res.json();

      if (data.success) {
        setResultStatus({
          success: true,
          message: `🎉 Successfully scheduled ${data.scheduled}/${data.total} recipes across your social calendar!`
        });
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        setUrlsText('');

        // Refresh scheduled list
        const refresh = await fetch('/api/batch-schedule');
        const refreshedJson = await refresh.json();
        if (refreshedJson?.posts) setScheduledPosts(refreshedJson.posts);
      } else {
        setResultStatus({
          success: false,
          message: data.message || 'Batch scheduling failed. Please check your Buffer token.'
        });
      }
    } catch (e: any) {
      setResultStatus({
        success: false,
        message: e.message || 'Network error during batch scheduling.'
      });
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const connectedProfiles = bufferConfig.profiles || [];
  const hasBufferToken = Boolean(bufferConfig.accessToken?.trim());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
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
                Bulk Recipe Auto-Scheduler
              </h2>
              <p style={{ fontSize: '0.80rem', color: 'var(--app-text-muted)', margin: 0 }}>
                Paste links to automatically render slides, add music, and schedule daily posts across TikTok & Instagram.
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
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
            <span>Load Links & Schedule</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}
          >
            <List size={16} />
            <span>Scheduled Calendar ({scheduledPosts.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'schedule' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
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

              {/* 1. URL List Input */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                    Recipe URLs ({parsedUrls.length} links ready)
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)' }}>
                    Paste 5 - 30 URLs (one per line)
                  </span>
                </div>
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder={`https://www.allrecipes.com/recipe/22728/hot-fudge-ice-cream-bar-dessert/\nhttps://www.allrecipes.com/recipe/21442/crispy-rangoon/\nhttps://www.foodnetwork.com/recipes/...`}
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: 1.5 }}
                />
              </div>

              {/* 2. Cadence & Timing Settings */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--app-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.90rem', color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color="var(--app-primary)" />
                  <span>Posting Cadence & Timing</span>
                </div>

                <div className="form-row" style={{ gap: 14 }}>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">Daily Cadence</label>
                    <select 
                      className="form-select"
                      value={cadence}
                      onChange={(e) => setCadence(e.target.value as any)}
                    >
                      <option value="1-daily">1 Post / Day (Recommended)</option>
                      <option value="2-daily">2 Posts / Day (Lunch & Dinner)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">Starting Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">{cadence === '2-daily' ? 'Lunch Post Time' : 'Daily Post Time'}</label>
                    <input
                      type="time"
                      className="form-input"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                    />
                  </div>

                  {cadence === '2-daily' && (
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label">Dinner Post Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={secondTime}
                        onChange={(e) => setSecondTime(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Audio & Format Settings */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--app-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px'
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.90rem', color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Music size={16} color="#3b82f6" />
                  <span>Music Soundtrack & Platform Formats</span>
                </div>

                <div className="form-row" style={{ gap: 14 }}>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">Background Music Vibe</label>
                    <select
                      className="form-select"
                      value={musicVibe}
                      onChange={(e) => setMusicVibe(e.target.value as any)}
                    >
                      {AUDIO_VIBE_PRESETS.map((p: AudioVibeOption) => (
                        <option key={p.id} value={p.id}>
                          {p.emoji} {p.name}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.70rem', color: 'var(--app-text-muted)', marginTop: 4, display: 'block' }}>
                      🎵 High-fidelity, royalty-free audio muxed into video with smooth fade-in/fade-out.
                    </span>
                  </div>

                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">Instagram Format</label>
                    <select
                      className="form-select"
                      value={instagramFormat}
                      onChange={(e) => setInstagramFormat(e.target.value as any)}
                    >
                      <option value="carousel">📸 3-Slide Photo Carousel (High Engagement)</option>
                      <option value="video">🎥 60 FPS Video Reel (With Music)</option>
                    </select>
                    <span style={{ fontSize: '0.70rem', color: 'var(--app-text-muted)', marginTop: 4, display: 'block' }}>
                      ✨ TikTok always receives the 60 FPS video with full soundtrack.
                    </span>
                  </div>
                </div>

                {/* Target Channels Display */}
                {connectedProfiles.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--app-border)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>
                      Target Publishing Channels:
                    </span>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      {connectedProfiles.map((p: BufferProfile) => (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid var(--app-primary)',
                            fontSize: '0.80rem',
                            fontWeight: 700,
                            color: '#fff'
                          }}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />
                          ) : (
                            <span>📱</span>
                          )}
                          <span>{p.formatted_username}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--app-primary)', textTransform: 'uppercase' }}>
                            ({p.service})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status or Progress Banner */}
              {isProcessing && (
                <div className="extraction-status-banner loading" style={{ padding: '14px 18px' }}>
                  <Loader2 size={18} className="animate-spin" color="var(--app-primary)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.86rem' }}>
                      Processing Daily Recipe Batch...
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--app-text-muted)', marginTop: 2 }}>
                      {progressMsg}
                    </div>
                  </div>
                </div>
              )}

              {resultStatus && (
                <div className={`extraction-status-banner ${resultStatus.success ? 'success' : 'error'}`} style={{ padding: '14px 18px' }}>
                  {resultStatus.success ? <CheckCircle2 size={18} color="#10b981" /> : <AlertCircle size={18} color="#ef4444" />}
                  <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{resultStatus.message}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                className="btn-primary"
                onClick={handleRunBatch}
                disabled={isProcessing || parsedUrls.length === 0 || !hasBufferToken}
                style={{
                  height: 48,
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  justifyContent: 'center',
                  gap: 10,
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.35)'
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Scheduling {parsedUrls.length} Recipes Daily...</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>Schedule {parsedUrls.length} Recipe{parsedUrls.length === 1 ? '' : 's'} on Autopilot</span>
                  </>
                )}
              </button>

            </div>
          ) : (
            /* Queue / Calendar Tab */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>
                  Scheduled Recipe Posts ({scheduledPosts.length})
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: 32, padding: '0 10px', fontSize: '0.75rem' }}
                  onClick={() => {
                    setIsLoadingScheduled(true);
                    fetch('/api/batch-schedule')
                      .then(r => r.json())
                      .then(d => d.posts && setScheduledPosts(d.posts))
                      .finally(() => setIsLoadingScheduled(false));
                  }}
                >
                  Refresh
                </button>
              </div>

              {isLoadingScheduled ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--app-text-muted)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                  <div>Loading scheduled posts...</div>
                </div>
              ) : scheduledPosts.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--app-text-muted)', border: '1px dashed var(--app-border)', borderRadius: 'var(--radius-lg)' }}>
                  <Calendar size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>No Scheduled Posts Yet</div>
                  <div style={{ fontSize: '0.80rem' }}>
                    Paste links in the "Load Links & Schedule" tab to populate your social calendar.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {scheduledPosts.map((post: any, idx: number) => (
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem' }}>
                          {post.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.72rem', color: 'var(--app-text-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} color="var(--app-primary)" />
                            {new Date(post.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                          <span>&bull;</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Music size={12} color="#3b82f6" />
                            {post.audioTrack || 'Aesthetic Track'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          background: post.status === 'scheduled' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: post.status === 'scheduled' ? '#10b981' : '#ef4444'
                        }}>
                          {post.status === 'scheduled' ? 'Scheduled' : 'Pending'}
                        </span>
                      </div>
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
