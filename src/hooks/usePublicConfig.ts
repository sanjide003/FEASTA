import { useCallback, useEffect, useState } from 'react';
import { cacheBranding, clearBrandingCache, normalizeBranding, readCachedBranding } from '../lib/branding';
import { cachedGetDoc } from '../lib/dataCache';
import { normalizeFestSetup } from '../lib/festConfig';
import { getFirebaseState } from '../lib/firebase';
import type { BrandingConfig, FestSetup, GeneralConfig } from '../types/festival';

export function usePublicBrandingAndGeneral() {
  const [branding, setBranding] = useState<BrandingConfig>(() => readCachedBranding());
  const [general, setGeneral] = useState<GeneralConfig>({});
  const [festSetup, setFestSetup] = useState<FestSetup>(() => normalizeFestSetup());
  const [loading, setLoading] = useState(true);

  const loadBase = useCallback(async (forceRefresh = false) => {
    const { db, isFirebaseConfigured } = getFirebaseState();
    if (!isFirebaseConfigured || !db) {
      setLoading(false);
      return { homeDoc: null, genDoc: null };
    }
    try {
      const [homeDoc, genDoc] = await Promise.all([
        cachedGetDoc<BrandingConfig>(db, 'settings', 'home_config', { ttlMs: 300_000, forceRefresh }),
        cachedGetDoc<GeneralConfig>(db, 'settings', 'general', { ttlMs: 300_000, forceRefresh }),
      ]);
      if (homeDoc) {
        setBranding(cacheBranding(homeDoc));
      } else {
        clearBrandingCache();
        setBranding(normalizeBranding());
      }
      if (genDoc) {
        setGeneral(genDoc);
        setFestSetup(normalizeFestSetup(genDoc.festSetup || {}));
      }
      return { homeDoc, genDoc };
    } catch {
      return { homeDoc: null, genDoc: null };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBase(false);
  }, [loadBase]);

  return { branding, general, festSetup, loading, reloadBase: loadBase };
}
