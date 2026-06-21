import { useState, useCallback, useEffect } from 'react';
import { getLauncherLayout, saveLauncherLayout, LauncherLayoutDoc } from '../lib/launcherLayout';

export function useLauncherLayout(uid: string | undefined, isAnonymous: boolean, env: string) {
  const [orderedSiteIds, setOrderedSiteIds] = useState<string[] | null>(null);
  const [animationSpeed, setAnimationSpeed] = useState<number | null>(null);
  const [visibleIconsRange, setVisibleIconsRange] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setOrderedSiteIds(null);
      setAnimationSpeed(null);
      setVisibleIconsRange(null);
      setLayoutLoading(true);

      if (!uid) {
        setLayoutLoading(false);
        return;
      }

      try {
        const layout = await getLauncherLayout(uid, isAnonymous, env);
        if (layout) {
          if (layout.orderedSiteIds) {
            setOrderedSiteIds(layout.orderedSiteIds);
          }
          if (layout.animationSpeed !== undefined) {
            setAnimationSpeed(layout.animationSpeed);
          }
          if (layout.visibleIconsRange !== undefined) {
            setVisibleIconsRange(layout.visibleIconsRange);
          }
        }
      } catch (e) {
        console.warn("Failed to load launcher layout", e);
      } finally {
        setLayoutLoading(false);
      }
    }

    load();
  }, [uid, isAnonymous, env]);

  const saveLayout = useCallback(async (ids: string[], options?: { animationSpeed?: number; visibleIconsRange?: number }) => {
    if (!uid) return;

    // Optimistic UI update
    if (ids) setOrderedSiteIds(ids);
    if (options?.animationSpeed !== undefined) setAnimationSpeed(options.animationSpeed);
    if (options?.visibleIconsRange !== undefined) setVisibleIconsRange(options.visibleIconsRange);
    
    setSaving(true);
    setSaveWarning(null);

    try {
      // Use current state for values not provided in options
      const currentIds = ids || orderedSiteIds || [];
      const currentSpeed = options?.animationSpeed !== undefined ? options.animationSpeed : (animationSpeed ?? 1.0);
      const currentRange = options?.visibleIconsRange !== undefined ? options.visibleIconsRange : (visibleIconsRange ?? 20);

      await saveLauncherLayout(uid, isAnonymous, currentIds, env, {
        animationSpeed: currentSpeed,
        visibleIconsRange: currentRange
      });
    } catch (e) {
      console.warn("Failed to save layout", e);
      setSaveWarning("Could not save your preferences to the server. Your changes are visible locally but will not persist.");
    }
    setSaving(false);
  }, [uid, isAnonymous, env, orderedSiteIds, animationSpeed, visibleIconsRange]);

  const clearWarning = useCallback(() => {
    setSaveWarning(null);
  }, []);

  return {
    orderedSiteIds,
    animationSpeed,
    visibleIconsRange,
    saving,
    saveWarning,
    layoutLoading,
    saveLayout,
    clearWarning
  };
}
