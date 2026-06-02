'use client';

import type { RefObject } from 'react';
import type { ChangeLogEntry, RoomOutgoing } from '@livediagram/api-schema';
import type { Element } from '@livediagram/diagram';
import { apiAppendChangeLogEntry } from '@/lib/api-client';
import { diffElements } from '@/lib/change-log';
import { HISTORY_LIMIT } from './useDiagramHistory';

// Activity-log entry emission lifted out of editor-page.tsx. The
// trio is cohesive (`emitChange` for an element diff, `emitTabMeta`
// for theme / background / lock toggles, `appendLogEntry` as the
// shared optimistic-append + API + room-broadcast + undo-stack
// path they both feed into) and the deps (selfParticipant, the
// roomRef, the entry-history ref, the share code, the diagramId)
// thread through together.
//
// `entryHistoryRef` stays owned by the page because the undo /
// redo flow also reads + mutates it; passing the ref in lets the
// hook write to the same buffer.

type RoomHandle = { send: (msg: RoomOutgoing) => void };

type Deps = {
  // Diagram-scoped fields the entry envelope needs. When
  // `diagramId` is null the emitters silently no-op (the page is
  // still bootstrapping; nothing to write against yet).
  diagramId: string | null;
  selfParticipant: { id: string; name: string; color: string };
  // Local activity-panel list. The hook prepends each new entry
  // and caps at 30 (the panel's scroll window). Setter is the
  // setState dispatcher so React's batching applies.
  setChangeLog: React.Dispatch<React.SetStateAction<ChangeLogEntry[]>>;
  // Append-only undo / redo memory: every new entry lands on
  // `past`; the future stack clears on each new emit. Capped at
  // HISTORY_LIMIT so the buffer can't grow without bound.
  entryHistoryRef: RefObject<{ past: ChangeLogEntry[]; future: ChangeLogEntry[] }>;
  // Share-code visitor scope (null for the owner). Threaded onto
  // the API call so edit-role visitors land their entries against
  // the correct diagram.
  sessionShareCode: string | null;
  // Live realtime room handle. The hook fires a `log` op on each
  // emit so peers see new audit rows in their own activity panel.
  // Ref so a reconnect doesn't force the hook to re-run.
  roomRef: RefObject<RoomHandle | null>;
};

type Api = {
  // Emit an element-diff entry. Builds the diff via `diffElements`
  // and skips if nothing actually changed. `override` lets a
  // caller stamp a custom kind + summary (used by the format
  // painter where the diff helper's auto-summary doesn't match
  // the user's intent).
  emitChange: (
    tabId: string,
    beforeElements: Element[],
    afterElements: Element[],
    override?: { kind: ChangeLogEntry['kind']; summary: string },
  ) => void;
  // Emit a tab-meta entry (no element diff payload). Used for
  // theme / canvas / pattern / lock changes that mutate Tab
  // metadata rather than its elements.
  emitTabMeta: (tabId: string, summary: string) => void;
};

export function useActivityLogEmitter(deps: Deps): Api {
  // Shared bookkeeping for any new log entry, regardless of
  // whether it came from an element diff or a tab-meta change.
  // Optimistic local append + fire-and-forget API + room
  // broadcast + push onto the undo / redo memory stack so the
  // entry pops cleanly on undo.
  const appendLogEntry = (entry: ChangeLogEntry) => {
    deps.setChangeLog((prev) => [entry, ...prev].slice(0, 30));
    deps.entryHistoryRef.current = {
      past: [...deps.entryHistoryRef.current.past, entry].slice(-HISTORY_LIMIT),
      future: [],
    };
    if (deps.diagramId) {
      apiAppendChangeLogEntry(
        deps.selfParticipant.id,
        deps.diagramId,
        entry,
        deps.sessionShareCode,
      ).catch(() => {});
    }
    deps.roomRef.current?.send({ kind: 'op', op: { kind: 'log', entry } });
  };

  const emitChange: Api['emitChange'] = (tabId, beforeElements, afterElements, override) => {
    if (!deps.diagramId) return;
    const diff = diffElements(beforeElements, afterElements);
    if (!diff) return;
    const entry: ChangeLogEntry = {
      id: crypto.randomUUID(),
      tabId,
      participantId: deps.selfParticipant.id,
      participantName: deps.selfParticipant.name,
      participantColor: deps.selfParticipant.color,
      kind: override?.kind ?? diff.kind,
      summary: override?.summary ?? diff.summary,
      elementIds: diff.elementIds,
      beforeState: diff.beforeState as Record<string, unknown>,
      afterState: diff.afterState as Record<string, unknown>,
      createdAt: Date.now(),
    };
    appendLogEntry(entry);
  };

  // Emit a tab-meta entry. The entry carries no before/after
  // payload (revert isn't supported for these in V1), so the
  // panel renders the row without a Revert button. Undo still
  // works because the matching state lives in useDiagramHistory.
  const emitTabMeta: Api['emitTabMeta'] = (tabId, summary) => {
    if (!deps.diagramId) return;
    const entry: ChangeLogEntry = {
      id: crypto.randomUUID(),
      tabId,
      participantId: deps.selfParticipant.id,
      participantName: deps.selfParticipant.name,
      participantColor: deps.selfParticipant.color,
      kind: 'edit',
      summary,
      elementIds: [],
      beforeState: {},
      afterState: {},
      createdAt: Date.now(),
    };
    appendLogEntry(entry);
  };

  return { emitChange, emitTabMeta };
}
