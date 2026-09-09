import { DEFAULT_BRAND_LOGO } from '../assets/defaultBrandLogo';

export { DEFAULT_BRAND_LOGO };

/**
 * Helper to resolve brand logo URL with 100% reliable fallback to embedded high-res data URI
 */
export function getBrandLogoUrl(url?: string): string {
  if (!url || !url.trim() || url.includes('snaprecipes-app-icon.png')) {
    return DEFAULT_BRAND_LOGO;
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  return getProxiedImageUrl(trimmed);
}

/**
 * Helper to wrap external recipe image URLs through the local server proxy
 * Bypasses CORS and food blog hotlink blockers (Allrecipes, Meredith, etc.)
 */
export function getProxiedImageUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // If already a local data URL, blob, or default brand logo, return directly
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Intercept snaprecipes-app-icon.png to return embedded data URI directly
  if (trimmed.includes('snaprecipes-app-icon.png')) {
    return DEFAULT_BRAND_LOGO;
  }

  // If local absolute path other than app icon, return directly
  if (trimmed.startsWith('/')) {
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
