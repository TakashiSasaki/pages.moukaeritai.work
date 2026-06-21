import React from 'react';
import { useAuth } from '../AuthContext';
import { getEnvironmentName } from '../lib/firestorePaths';
import LauncherGrid from './LauncherGrid';
import { useLatestAuditResults } from '../hooks/useLatestAuditResults';
import { useLauncherLayout } from '../hooks/useLauncherLayout';
import { useLauncherSitesFromResults } from '../hooks/useLauncherSitesFromResults';
import { applyLocalOrderChange } from '../lib/launcherSites';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LauncherPage() {
  const { user } = useAuth();
  const isAnonymous = !!user?.isAnonymous;
  const env = getEnvironmentName(import.meta.env.MODE);

  const { results, loading: resultsLoading, error } = useLatestAuditResults(user?.uid, isAnonymous, env);
  const { 
    orderedSiteIds, 
    animationSpeed, 
    visibleIconsRange, 
    saving, 
    saveWarning, 
    layoutLoading, 
    saveLayout 
  } = useLauncherLayout(user?.uid, isAnonymous, env);

  const { sites, defaultOrderedSiteIds } = useLauncherSitesFromResults(results, orderedSiteIds);

  const loading = resultsLoading || layoutLoading;

  const handleMove = React.useCallback(async (index: number, direction: -1 | 1) => {
    const currentIds = sites.map(s => s.id);
    const newIds = applyLocalOrderChange(currentIds, index, direction);
    await saveLayout(newIds);
  }, [sites, saveLayout]);

  const handleReset = React.useCallback(async () => {
    if (!user || isAnonymous) return;
    await saveLayout(defaultOrderedSiteIds);
  }, [user, isAnonymous, saveLayout, defaultOrderedSiteIds]);

  const handleSettingsChange = React.useCallback(async (settings: { animationSpeed?: number; visibleIconsRange?: number }) => {
    await saveLayout(orderedSiteIds || [], settings);
  }, [saveLayout, orderedSiteIds]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  let emptyMessage = 'Run an audit from the dashboard to populate the launcher.';
  if (!user) {
    emptyMessage = 'You must be logged in to view the launcher.';
  } else if (isAnonymous) {
    emptyMessage = 'Guest launcher is available after a persisted audit. Sign in with Google or run an audit from the dashboard.';
  }

  return (
    <LauncherGrid
      sites={sites}
      saving={saving}
      saveWarning={saveWarning}
      emptyMessage={emptyMessage}
      emptyActionLabel="Go to Dashboard"
      emptyActionTo="/"
      showEmptyAction={true}
      onMove={handleMove}
      onOrderChange={saveLayout}
      animationSpeed={animationSpeed}
      visibleIconsRange={visibleIconsRange}
      onSettingsChange={handleSettingsChange}
      onReset={handleReset}
      showReset={true}
      readOnly={false}
    />
  );
}
