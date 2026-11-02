'use client';

// Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs" in each product), the hook
// every editor wires: it loads any tab not yet in this browser first, so no tab is skipped for being unopened, then
// restyles every other tab from the active one in ONE history-pushing commit (one undo step), and says what happened.
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { styleAllMessage, styleAllTabs, type StyleAllOutcome } from '../../lib/tab-style-to-all';

export type StyleableTab = { id: string; locked?: boolean; elements: readonly unknown[] };

type Deps<T extends StyleableTab> = {
  // Only an Editor of the whole document may: false for a Participant, a Viewer, or a tab-scoped session.
  canApply: boolean;
  activeId: string;
  // Fetches every tab not loaded yet (the search sweep); resolves once each has landed or failed.
  loadAllTabs: () => Promise<unknown>;
  // Whether a tab's content is authoritative here, so writing it can never blank the stored tab
  // (docs/specs/006-document/per-tab-storage.md "Autosave guard").
  isTabLoaded: (id: string) => boolean;
  commitTabs: (mapTabs: (ts: T[]) => T[]) => void;
  // The editor's own restyle: its theme switch, then the style keys (withTabStyleOf).
  restyle: (tab: T, source: T) => T;
  notify: (message: string) => void;
  // Telemetry, once per press that styled anything.
  onApplied?: (outcome: StyleAllOutcome) => void;
};

export function useApplyStyleToAllTabs<T extends StyleableTab>(
  deps: Deps<T>,
): { applyToAllTabs: () => Promise<void>; applying: boolean } {
  const [applying, setApplying] = useState(false);
  // A second press while the first is still loading tabs does nothing.
  const busy = useRef(false);
  // The commit's updater runs as React renders it, not when it is queued, so its outcome is told from an effect
  // once that render has landed.
  const outcomeRef = useRef<StyleAllOutcome | null>(null);
  const [landed, setLanded] = useState(0);
  const tell = useEffectEvent((outcome: StyleAllOutcome) => {
    deps.notify(styleAllMessage(outcome));
    if (outcome.styled > 0) deps.onApplied?.(outcome);
  });
  useEffect(() => {
    const outcome = outcomeRef.current;
    if (!outcome) return;
    outcomeRef.current = null;
    tell(outcome);
  }, [landed]);

  const applyToAllTabs = async () => {
    if (!deps.canApply || busy.current) return;
    busy.current = true;
    setApplying(true);
    try {
      await deps.loadAllTabs();
      const { activeId, restyle, isTabLoaded } = deps;
      deps.commitTabs((ts) => {
        const done = styleAllTabs(
          ts,
          activeId,
          restyle,
          (t) => isTabLoaded(t.id) || t.elements.length > 0,
        );
        outcomeRef.current = done.outcome;
        return done.tabs;
      });
      setLanded((n) => n + 1);
    } finally {
      busy.current = false;
      setApplying(false);
    }
  };
  return { applyToAllTabs, applying };
}
