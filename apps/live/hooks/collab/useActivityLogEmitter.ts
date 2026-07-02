'use client';

import type { RefObject } from 'react';
import {
  CHANGE_LOG_LIST_LIMIT,
  type ChangeLogEntry,
  type RoomOutgoing,
} from '@livediagram/api-schema';
import type { Element } from '@livediagram/diagram';
import { apiAppendChangeLogEntry } from '@/lib/api-client';
import { diffElements } from '@/lib/change-log';
import { entryHistoryFill, type EntryHistory } from '@/lib/entry-history';

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
  // Undo / redo memory: one token-stamped marker per history step (see
  // lib/entry-history). The history mutators push null markers; each
  // emit here fills its step's marker (by `fillToken` for debounced
  // emits, newest otherwise) so undo deletes exactly the entry its
  // step emitted.
  entryHistoryRef: RefObject<EntryHistory>;
  // Share-code visitor scope (null for the owner). Threaded onto
  // the API call so edit-role visitors land their entries against
  // the correct diagram.
  sessionShareCode: string | null;
  // Live realtime room handle. The hook fires a `log` op on each
  // emit so peers see new audit rows in their own activity panel.
  // Ref so a reconnect doesn't force the hook to re-run.
  roomRef: RefObject<RoomHandle | null>;
};

// `undoable: false` keeps the entry out of the undo pairing — for
// emits whose mutation doesn't push history (spec/39 session tools), so
// the entry can't glue itself onto an unrelated step's undo.
// `fillToken` names the exact history step the entry belongs to (the
// token its commit/checkpoint returned) — required for the DEBOUNCED
// emitters, whose flush can land up to 500ms after the gesture, by
// which time other steps may sit on top of the marker stack.
type EmitOpts = { undoable?: boolean; fillToken?: number };

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
    opts?: EmitOpts,
  ) => void;
  // Emit a tab-meta entry (no element diff payload). Used for
  // theme / canvas / pattern / lock changes that mutate Tab
  // metadata rather than its elements.
  emitTabMeta: (tabId: string, summary: string, opts?: EmitOpts) => void;
};

export function useActivityLogEmitter(deps: Deps): Api {
  // Shared bookkeeping for any new log entry, regardless of
  // whether it came from an element diff or a tab-meta change.
  // Optimistic local append + fire-and-forget API + room
  // broadcast + fill the step's undo marker so the entry pops
  // cleanly on undo (skipped for non-undoable emits).
  const appendLogEntry = (entry: ChangeLogEntry, opts?: EmitOpts) => {
    // Cap the in-session list at the same limit the server hydrates
    // (spec/12), so the panel shows a consistent "most recent N".
    deps.setChangeLog((prev) => [entry, ...prev].slice(0, CHANGE_LOG_LIST_LIMIT));
    if (opts?.undoable !== false) {
      deps.entryHistoryRef.current = entryHistoryFill(
        deps.entryHistoryRef.current,
        entry,
        opts?.fillToken,
      );
    }
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

  const emitChange: Api['emitChange'] = (tabId, beforeElements, afterElements, override, opts) => {
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
    appendLogEntry(entry, opts);
  };

  // Emit a tab-meta entry. The entry carries no before/after
  // payload (revert isn't supported for these in V1), so the
  // panel renders the row without a Revert button. Undo still
  // works because the matching state lives in useDiagramHistory.
  const emitTabMeta: Api['emitTabMeta'] = (tabId, summary, opts) => {
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
    appendLogEntry(entry, opts);
  };

  return { emitChange, emitTabMeta };
}
