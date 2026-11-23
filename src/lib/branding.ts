import type { BrandingConfig } from '../types/festival';

export const BRANDING_CACHE_KEY = 'fest_home_config';

export const DEFAULT_BRANDING: Readonly<BrandingConfig> = Object.freeze({
  configured: false,
  festName1: 'Fest Management',
  festName2: 'Setup Required',
  tagline: 'Configure your festival from the Admin Panel',
  logoUrl: '',
  aboutSubtitle: 'Festival information not configured',
  aboutText: 'Festival details will appear here after the administrator completes setup.',
  footerText: 'Festival management system',
});

export function normalizeBranding(raw: Partial<BrandingConfig> = {}): BrandingConfig {
  const festName1 = String(raw.festName1 || '').trim();
  const festName2 = String(raw.festName2 || '').trim();
  const configured = raw.setupCompleted === true || Boolean(festName1);
  return {
    ...DEFAULT_BRANDING,
    ...raw,
    festName1: festName1 || DEFAULT_BRANDING.festName1,
    festName2: festName2 || (configured ? '' : DEFAULT_BRANDING.festName2),
    configured,
  };
}

export const brandingName = (config?: Partial<BrandingConfig>) => {
  const norm = normalizeBranding(config);
  return [norm.festName1, norm.festName2].filter(Boolean).join(' ');
};

export const currentYear = () => String(new Date().getFullYear());

export function cacheBranding(raw: Partial<BrandingConfig>): BrandingConfig {
  const value = normalizeBranding(raw);
  try {
    if (value.configured) localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(raw));
    else localStorage.removeItem(BRANDING_CACHE_KEY);
  } catch {
    // Ignore storage errors
  }
  return value;
}

export function readCachedBranding(): BrandingConfig {
  try {
    return normalizeBranding(JSON.parse(localStorage.getItem(BRANDING_CACHE_KEY) || '{}'));
  } catch {
    return normalizeBranding();
  }
}

export function clearBrandingCache() {
  try {
    localStorage.removeItem(BRANDING_CACHE_KEY);
  } catch {
    // Ignore
  }
}

export const isBase64Image = (value: unknown) =>
  /^data:image\/(jpeg|png|webp|gif);base64,/i.test(String(value || ''));

export const isValidImageSrc = (value: unknown) => {
  const src = String(value || '').trim();
  return isBase64Image(src) || /^https?:\/\//i.test(src);
};
