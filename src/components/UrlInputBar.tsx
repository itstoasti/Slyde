import React, { useState } from 'react';
import { Link2, Sparkles, Loader2, CheckCircle2, AlertCircle, ListPlus } from 'lucide-react';
import { extractRecipeFromUrl } from '../utils/recipeExtractor';
import { RecipeData } from '../types';

interface UrlInputBarProps {
  onRecipeExtracted: (recipe: RecipeData) => void;
  onMultipleExtracted?: (recipes: RecipeData[]) => void;
  brandDefaults?: { brandName?: string; socialHandle?: string; ctaUrl?: string; brandLogo?: string; brandLogoSize?: number };
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({ 
  onRecipeExtracted, 
  onMultipleExtracted,
  brandDefaults 
}) => {
  const [url, setUrl] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  const handleSingleExtract = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setStatus({ type: 'loading', message: 'Extracting recipe, photo, ingredients & method without AI...' });

    try {
      const extracted = await extractRecipeFromUrl(url, brandDefaults);
      onRecipeExtracted(extracted);
      setStatus({
        type: 'success',
        message: `✨ Extracted "${extracted.title}" with ${extracted.ingredients.length} ingredients & ${extracted.method.length} steps!`
      });
      setUrl('');
      setTimeout(() => {
        setStatus({ type: 'idle', message: '' });
      }, 5000);
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: `Extracted with fallback template.`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawList = batchUrls
      .split(/[\n,]+/)
      .map(u => u.trim())
      .filter(u => u.length > 5);

    if (rawList.length === 0) return;

    setIsLoading(true);
    setStatus({ type: 'loading', message: `Batch extracting ${rawList.length} recipes from URLs...` });

    try {
      const extractedList: RecipeData[] = [];
      for (let i = 0; i < rawList.length; i++) {
        const item = await extractRecipeFromUrl(rawList[i], brandDefaults);
        extractedList.push(item);
      }

      if (onMultipleExtracted) {
        onMultipleExtracted(extractedList);
      } else if (extractedList.length > 0) {
        onRecipeExtracted(extractedList[0]);
      }

      setStatus({
        type: 'success',
        message: `🎉 Successfully imported ${extractedList.length} recipes into queue!`
      });
      setBatchUrls('');
      setIsBatchMode(false);
      setTimeout(() => {
        setStatus({ type: 'idle', message: '' });
      }, 5000);
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Batch extraction finished with fallback items.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="url-bar-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>
          {isBatchMode ? 'Batch Import Multiple Recipe URLs' : 'Add Recipe by URL'}
        </span>
        <button
          type="button"
          onClick={() => setIsBatchMode(!isBatchMode)}
          style={{ background: 'transparent', border: 'none', color: 'var(--app-primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {isBatchMode ? <Link2 size={13} /> : <ListPlus size={13} />}
          <span>{isBatchMode ? 'Single URL Mode' : '+ Batch Paste Multiple URLs'}</span>
        </button>
      </div>

      {!isBatchMode ? (
        <form onSubmit={handleSingleExtract} className="url-input-box">
          <Link2 size={18} className="url-input-icon" />
          <input
            type="text"
            className="url-input-field"
            placeholder="Paste any recipe link (food blog, allrecipes, NYT)..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            className="url-extract-btn"
            disabled={isLoading || !url.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Extracting...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Generate Deck</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBatchExtract} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Paste multiple recipe URLs (one per line or comma-separated)...&#10;https://allrecipes.com/recipe/1&#10;https://nytimes.com/cooking/recipe/2"
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
          />
          <button
            type="submit"
            className="url-extract-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={isLoading || !batchUrls.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Processing Batch URLs...</span>
              </>
            ) : (
              <>
                <ListPlus size={16} />
                <span>Import All to Queue</span>
              </>
            )}
          </button>
        </form>
      )}

      {status.type !== 'idle' && (
        <div className={`extraction-status-banner ${status.type}`}>
          {status.type === 'loading' && <Loader2 size={14} className="animate-spin" />}
          {status.type === 'success' && <CheckCircle2 size={14} />}
          {status.type === 'error' && <AlertCircle size={14} />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
};
