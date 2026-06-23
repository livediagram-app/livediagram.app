// Per-user editor preferences (spec/20), lifted out of useEditorState.
// One localStorage key, applies to every diagram the user opens from
// this device. Loaded on mount (not gated on diagramId, since
// preferences aren't diagram-scoped) and mutated through the
// SettingsDialog. Also owns the two ref mirrors the drag hook reads on
// every pointer move, and the side effects that apply preference flags
// (reduce motion, AI panel auto-open).

import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from '@/hooks/ui/useReduceMotion';
import { usePanelOpacity } from '@/hooks/ui/usePanelOpacity';
import {
  readUserPreferences,
  fetchUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';

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
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  useEffect(() => {
    if (userPreferences.aiAssistanceEnabled) setAiPanelVisible(true);
    // setAiPanelVisible is a useState setter (stable identity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPreferences.aiAssistanceEnabled]);
  // Apply the "Reduce motion" preference (spec/20) to <html>. The OS
  // prefers-reduced-motion media query is honoured by globals.css
  // regardless; this lets the user force it on independent of the OS.
  useReduceMotion(userPreferences.reduceMotion === true);
  // Apply the "Panel opacity" preference (spec/20) to the floating panels
  // via the --lvd-panel-opacity custom property. Floating panels only; the
  // minimal dock never reads the var.
  usePanelOpacity(userPreferences.panelOpacity);
  // Mirror the auto-rebind flag into its own ref so the drag move
  // handler can read it without re-attaching listeners. Defaults
  // to true (auto-rebind on) so a fresh session keeps today's UX.
  const autoRebindArrowsRef = useRef<boolean>(userPreferences.autoRebindArrows !== false);
  autoRebindArrowsRef.current = userPreferences.autoRebindArrows !== false;
  // Same mirror for the alignment-guide preference so the drag move
  // handler can gate the guide computation without re-attaching its
  // listeners. Defaults to true (guides on) so a fresh session shows
  // them; flipping the Settings toggle takes effect on the next move.
  const alignmentGuidesRef = useRef<boolean>(userPreferences.alignmentGuides !== false);
  alignmentGuidesRef.current = userPreferences.alignmentGuides !== false;

  // Load the cached preferences once on mount. Missing or unparseable
  // entries collapse to `{}`; the per-flag default then depends on
  // the consumer's comparison: `autoRebindArrows`, `telemetryEnabled`
  // and `recogniseShapes` read via `!== false` so undefined = on, while
  // `drawToAdd` reads via `=== true` so undefined = off (matches
  // spec/20's "drop-at-centre" default).
  useEffect(() => {
    setUserPreferences(readUserPreferences());
  }, []);

  // Server-side preferences sync (spec/20). Once the owner id
  // resolves, fetch the row from D1 and merge it over the
  // localStorage cache. Server wins for any key present on both
  // sides. The cache-only read above still fired first so the UI
  // never blocks on this network step; this just reconciles toggles
  // the user made on another device.
  useEffect(() => {
    if (!ownerId || ownerId === 'self') return;
    if (passwordGated) return;
    let cancelled = false;
    void fetchUserPreferences(ownerId).then((merged) => {
      if (cancelled || merged === null) return;
      setUserPreferences(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId, passwordGated]);

  return { userPreferences, setUserPreferences, autoRebindArrowsRef, alignmentGuidesRef };
}
