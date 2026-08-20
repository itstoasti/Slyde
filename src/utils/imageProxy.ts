/**
 * Helper to wrap external recipe image URLs through the local server proxy
 * Bypasses CORS and food blog hotlink blockers (Allrecipes, Meredith, etc.)
 */
export function getProxiedImageUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // If already a local data URL, blob, or local path, return directly
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('/')) {
    return trimmed;
  }

  // If already proxied, return directly
  if (trimmed.includes('/api/proxy-image?url=')) {
    return trimmed;
  }

  // If external http/https image, route through local proxy
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return `/api/proxy-image?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}
