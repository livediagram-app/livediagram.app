'use client';

// A Session tab's writes (docs/specs/026-plan/session-tabs.md "Making one", "Real time"): Start Session and a set-up
// change are an Editor's edits, one undo step each; running the session (the current card, outcomes, the baton) is
// not undoable, as the session tools' timer is not, so it ticks the tab without history and rides the tab's sync. A
// locked tab refuses all of them.
import { useCallback, useMemo } from 'react';
import {
  SESSION_KINDS,
  isDefaultTabName,
  readSessionTab,
  type SessionSetup,
  type SessionTabState,
  type Tab,
} from '@liveplanner/project';
import { track } from '@/lib/telemetry';

export type SessionTabActions = {
  // Makes the open tab a Session tab running `session`, named for its kind while it keeps its default name.
  startSession: (session: SessionTabState) => void;
  // The open Session tab's set-up replaced; its outcomes, baton and current card stay.
  changeSetup: (setup: SessionSetup) => void;
  // The running session of tab `tabId` changed (`change` answers the next state, or the same one for none).
  runSession: (tabId: string, change: (s: SessionTabState) => SessionTabState) => void;
};

export function useSessionTabActions({
  activeId,
  commitTabs,
  tickTabs,
}: {
  activeId: string;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  tickTabs: (map: (ts: Tab[]) => Tab[]) => void;
}): SessionTabActions {
  const startSession = useCallback<SessionTabActions['startSession']>(
    (session) => {
      commitTabs((ts) =>
        ts.map((t) =>
          t.id === activeId && !t.locked
            ? {
                ...t,
                kind: 'session',
                name: isDefaultTabName(t.name) ? SESSION_KINDS[session.sessionKind].label : t.name,
                session,
                dashboard: undefined,
              }
            : t,
        ),
      );
      track('Plan', 'Created', 'SessionTab');
    },
    [commitTabs, activeId],
  );
  const changeSetup = useCallback<SessionTabActions['changeSetup']>(
    (setup) => {
      commitTabs((ts) =>
        ts.map((t) => {
          const s = t.id === activeId && !t.locked ? readSessionTab(t.session) : null;
          return s ? { ...t, session: { ...s, setup } } : t;
        }),
      );
      track('Plan', 'Changed', 'SessionSetup');
    },
    [commitTabs, activeId],
  );
  const runSession = useCallback<SessionTabActions['runSession']>(
    (tabId, change) => {
      tickTabs((ts) => {
        let changed = false;
        const next = ts.map((t) => {
          const s = t.id === tabId && !t.locked ? readSessionTab(t.session) : null;
          if (!s) return t;
          const after = change(s);
          if (after === s) return t;
          changed = true;
          return { ...t, session: after };
        });
        return changed ? next : ts;
      });
    },
    [tickTabs],
  );
  return useMemo(
    () => ({ startSession, changeSetup, runSession }),
    [startSession, changeSetup, runSession],
  );
}
