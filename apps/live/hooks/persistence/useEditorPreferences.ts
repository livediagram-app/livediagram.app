// Per-user editor preferences (docs/specs/007-editor/user-preferences.md), lifted out of useEditorState.
// One localStorage key, applies to every document the user opens from
// this device. Read from the device cache once hydrated (not gated on
// documentId, since preferences aren't document-scoped) and mutated through
// the SettingsDialog. Also owns the two ref mirrors the drag hook reads on
// every pointer move, and the side effects that apply preference flags
// (reduce motion, AI panel auto-open).

import { setPlanModeEnabled } from '@/lib/offered-editor-modes';
import { useCallback, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import { useReduceMotion } from '@/hooks/ui/useReduceMotion';
import { usePanelOpacity } from '@/hooks/ui/usePanelOpacity';
import {
  autoRebindArrowsEnabled,
  readUserPreferences,
  fetchUserPreferences,
  PREFERENCES_CHANGED_EVENT,
  STORAGE_KEY,
  type UserPreferences,
} from '@/lib/user-preferences';
import { readLocalStorageSafe } from '@/lib/local-storage-safe';
import { useLatest } from '@/hooks/ui/useLatest';

// The preferences cached on this device, as an external store: the server
// and hydration snapshot is empty, so the static export never reads
// localStorage in the render it hydrates. The parse is kept per raw string,
// so an unchanged cache is the same object and never re-renders anyone.
const NO_PREFERENCES: UserPreferences = {};
let cachedRaw: string | null = null;
let cachedPreferences: UserPreferences = NO_PREFERENCES;

function getCachedPreferences(): UserPreferences {
  const raw = readLocalStorageSafe(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPreferences = raw === null ? NO_PREFERENCES : readUserPreferences();
  }
  return cachedPreferences;
}

function subscribeCachedPreferences(onChange: () => void): () => void {
  window.addEventListener(PREFERENCES_CHANGED_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(PREFERENCES_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const getNoPreferences = (): UserPreferences => NO_PREFERENCES;

type EditorPreferencesDeps = {
  // The resolved owner id: Clerk userId for signed-in users, the
  // per-browser participant id for guests. 'self' is the pre-hydration
  // placeholder, which blocks the server sync until the real id lands.
  ownerId: string;
  // True while the visitor still faces the share-password gate. No
  // point fetching preferences for someone who hasn't got in yet.
  passwordGated: boolean;
  // From usePanelLayout: flipping the AI preference on pops the panel.
  setAiPanelVisible: (visible: boolean) => void;
};

export function useEditorPreferences(deps: EditorPreferencesDeps) {
  const { ownerId, passwordGated, setAiPanelVisible } = deps;
  // Missing or unparseable entries collapse to `{}`; the per-flag default then
  // depends on the consumer's comparison: `telemetryEnabled` reads via
  // `!== false` so undefined = on, while `autoRebindArrows` (via
  // autoRebindArrowsEnabled) and `drawToAdd` read via `=== true` so
  // undefined = off (matches docs/specs/007-editor/user-preferences.md's defaults).
  // The cache stands until this session sets preferences of its own (the
  // server merge below, or any toggle), which then win.
  const cached = useSyncExternalStore(
    subscribeCachedPreferences,
    getCachedPreferences,
    getNoPreferences,
  );
  const [chosen, setChosen] = useState<UserPreferences | null>(null);
  const userPreferences = chosen ?? cached;
  const setUserPreferences = useCallback((next: UserPreferences) => setChosen(next), []);
  // True once the server copy has been merged in, or failed to arrive: the
  // point after which a one-way latch such as `powerUserOfferShown` can be
  // trusted not to be stale (docs/specs/007-editor/power-user-mode.md).
  const [prefsSettled, setPrefsSettled] = useState(false);
  const openAiPanel = useEffectEvent(() => setAiPanelVisible(true));
  useEffect(() => {
    if (userPreferences.aiAssistanceEnabled) openAiPanel();
  }, [userPreferences.aiAssistanceEnabled]);
  // Apply the "Reduce motion" preference (docs/specs/007-editor/user-preferences.md) to <html>. The OS
  // prefers-reduced-motion media query is honoured by globals.css
  // regardless; this lets the user force it on independent of the OS.
  useReduceMotion(userPreferences.reduceMotion === true);
  // Settings › Experimental: Plan mode is offered unless switched off (offered-editor-modes,
  // docs/specs/026-plan/plan-mode.md).
  useEffect(() => {
    setPlanModeEnabled(userPreferences.planModeEnabled !== false);
  }, [userPreferences.planModeEnabled]);
  // Apply the "Panel opacity" preference (docs/specs/007-editor/user-preferences.md) to the floating panels
  // via the --lvd-panel-opacity custom property.
  usePanelOpacity(userPreferences.panelOpacity);
  // Mirror the auto-rebind flag into its own ref so the drag move
  // handler can read it without re-attaching listeners. Defaults to
  // ON (docs/specs/007-editor/user-preferences.md); the Settings toggle turns it off.
  const autoRebindArrowsRef = useLatest<boolean>(autoRebindArrowsEnabled(userPreferences));
  // Same mirror for the alignment-guide preference so the drag move
  // handler can gate the guide computation without re-attaching its
  // listeners. Defaults to true (guides on) so a fresh session shows
  // them; flipping the Settings toggle takes effect on the next move.
  const alignmentGuidesRef = useLatest<boolean>(userPreferences.alignmentGuides !== false);

  // Server-side preferences sync (docs/specs/007-editor/user-preferences.md). Once the owner id
  // resolves, fetch the row from D1 and merge it over the
  // localStorage cache. Server wins for any key present on both
  // sides. The cache read above still lands first so the UI
  // never blocks on this network step; this just reconciles toggles
  // the user made on another device.
  useEffect(() => {
    if (!ownerId || ownerId === 'self') return;
    if (passwordGated) return;
    let cancelled = false;
    void fetchUserPreferences(ownerId).then((merged) => {
      if (cancelled) return;
      if (merged !== null) setChosen(merged);
      setPrefsSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId, passwordGated]);

  return {
    userPreferences,
    setUserPreferences,
    prefsSettled,
    autoRebindArrowsRef,
    alignmentGuidesRef,
  };
}

/** The preferences cached on this device, live: re-renders on a same-tab write or another tab's. */
export function useCachedPreferences(): UserPreferences {
  return useSyncExternalStore(subscribeCachedPreferences, getCachedPreferences, getNoPreferences);
}
