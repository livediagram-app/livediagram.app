'use client';

import { useRef, type RefObject } from 'react';
import {
  CHANGE_LOG_LIST_LIMIT,
  type ChangeLogEntry,
  type RoomOutgoing,
} from '@livediagram/api-schema';
import type { Element } from '@livediagram/diagram';
import { apiAppendChangeLogEntry, apiDeleteChangeLogEntry } from '@/lib/api-client';
import { coalesceDiff, diffElements } from '@/lib/change-log';
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
  // Current panel list, used by the coalescing check below to see
  // whether the log's newest entry is the one this client just
  // emitted. Ref (mirrored from state by the page) so the emit
  // callbacks always read the fresh list.
  changeLogRef: RefObject<ChangeLogEntry[]>;
};

// How long a fresh emit keeps folding into the previous entry for the
// same target (see the coalescing block below). Three drags of the
// same square inside this window read as ONE "Moved a Square" row,
// not three; each merge refreshes the merged entry's `createdAt`, so
// an active editing run keeps extending its own row.
const COALESCE_WINDOW_MS = 10_000;

// `undoable: false` keeps the entry out of the undo pairing — for
// emits whose mutation doesn't push history (spec/39 session tools), so
// the entry can't glue itself onto an unrelated step's undo.
// `fillToken` names the exact history step the entry belongs to (the
// token its commit/checkpoint returned) — required for the DEBOUNCED
// emitters, whose flush can land up to 500ms after the gesture, by
// which time other steps may sit on top of the marker stack.
// `coalesceKey` opts a tab-meta emit into the repeat-merge behaviour:
// two emits with the same key inside COALESCE_WINDOW_MS collapse into
// one entry carrying the newest summary (element diffs derive their
// key from the affected element ids and don't need to pass one).
type EmitOpts = { undoable?: boolean; fillToken?: number; coalesceKey?: string };

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
  // The last entry THIS client appended with a coalesce key. A fresh
  // emit merges into it only while it's still the log's newest entry
  // (nothing — remote entry, undo, revert — landed in between) and
  // inside the window; anything else simply appends as before.
  const lastEmitRef = useRef<{ key: string; entryId: string } | null>(null);

  const coalesceTarget = (key: string): ChangeLogEntry | null => {
    const last = lastEmitRef.current;
    if (!last || last.key !== key) return null;
    const newest = deps.changeLogRef.current?.[0];
    if (!newest || newest.id !== last.entryId) return null;
    if (Date.now() - newest.createdAt > COALESCE_WINDOW_MS) return null;
    return newest;
  };

  // D1 writes for the SAME entry id must land in emit order: each merge
  // is a delete + re-append pair, and two quick merges with independent
  // chains could interleave (del1, del2, app1, app2-hits-existing-id),
  // leaving D1 on the older span while the panel and the room show the
  // newer one until a reload. One serial queue keeps the pairs atomic
  // relative to each other; failures inside stay swallowed as before.
  const d1QueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueD1 = (task: () => Promise<void>) => {
    d1QueueRef.current = d1QueueRef.current.then(task, task);
  };

  // Swap the coalesced entry in place, everywhere the original went:
  // panel list, D1 (delete + re-append under the SAME id, so the undo
  // marker that holds the original still pairs with the merged row),
  // and the room (remove + add, in order, so peers converge).
  const replaceLogEntry = (merged: ChangeLogEntry, key: string) => {
    deps.setChangeLog((prev) => prev.map((e) => (e.id === merged.id ? merged : e)));
    if (deps.diagramId) {
      const { id: pid } = deps.selfParticipant;
      const diagramId = deps.diagramId;
      enqueueD1(() =>
        apiDeleteChangeLogEntry(pid, diagramId, merged.id, deps.sessionShareCode)
          .catch(() => {})
          .then(() =>
            apiAppendChangeLogEntry(pid, diagramId, merged, deps.sessionShareCode).catch(() => {}),
          )
          .then(() => undefined),
      );
    }
    deps.roomRef.current?.send({ kind: 'op', op: { kind: 'log-remove', entryId: merged.id } });
    deps.roomRef.current?.send({ kind: 'op', op: { kind: 'log', entry: merged } });
    lastEmitRef.current = { key, entryId: merged.id };
  };

  // A merge that nets out to "nothing changed" (dragged away and back
  // inside the window) deletes the earlier entry instead of leaving a
  // no-op row. The undo marker still holding the deleted entry is
  // harmless: its undo-delete just no-ops.
  const removeLogEntry = (entryId: string) => {
    deps.setChangeLog((prev) => prev.filter((e) => e.id !== entryId));
    if (deps.diagramId) {
      const { id: pid } = deps.selfParticipant;
      const diagramId = deps.diagramId;
      enqueueD1(() =>
        apiDeleteChangeLogEntry(pid, diagramId, entryId, deps.sessionShareCode)
          .catch(() => {})
          .then(() => undefined),
      );
    }
    deps.roomRef.current?.send({ kind: 'op', op: { kind: 'log-remove', entryId } });
    lastEmitRef.current = null;
  };

  // Shared bookkeeping for any new log entry, regardless of
  // whether it came from an element diff or a tab-meta change.
  // Optimistic local append + fire-and-forget API + room
  // broadcast + fill the step's undo marker so the entry pops
  // cleanly on undo (skipped for non-undoable emits).
  const appendLogEntry = (entry: ChangeLogEntry, opts?: EmitOpts, coalesceKey?: string) => {
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
    lastEmitRef.current = coalesceKey ? { key: coalesceKey, entryId: entry.id } : null;
  };

  const emitChange: Api['emitChange'] = (tabId, beforeElements, afterElements, override, opts) => {
    if (!deps.diagramId) return;
    const diff = diffElements(beforeElements, afterElements);
    if (!diff) return;
    // Repeat edits to the same element set fold into the previous
    // entry (see COALESCE_WINDOW_MS). Overridden and non-undoable
    // emits stay out: their summaries aren't derivable from a diff.
    const canCoalesce = !override && opts?.undoable !== false;
    const key = canCoalesce
      ? `el:${tabId}:${diff.kind}:${[...diff.elementIds].sort().join(',')}`
      : undefined;
    const target = key ? coalesceTarget(key) : null;
    if (target && key) {
      const merged = coalesceDiff(
        target.beforeState as Record<string, Element | null>,
        diff.afterState,
      );
      if (!merged) {
        removeLogEntry(target.id);
        return;
      }
      // Note: the fresh gesture's own history marker stays null — undo
      // of that step keeps the merged row (still true for the earlier
      // span); undoing past the FIRST gesture deletes it via the
      // marker the original append filled.
      replaceLogEntry(
        {
          ...target,
          kind: merged.kind,
          summary: merged.summary,
          elementIds: merged.elementIds,
          beforeState: merged.beforeState as Record<string, unknown>,
          afterState: merged.afterState as Record<string, unknown>,
          createdAt: Date.now(),
        },
        // Re-key on the merged ids: elements whose span netted out were
        // dropped, and a later emit against the original set must NOT
        // merge into an entry that no longer covers them.
        `el:${tabId}:${merged.kind}:${[...merged.elementIds].sort().join(',')}`,
      );
      return;
    }
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
    appendLogEntry(entry, opts, key);
  };

  // Emit a tab-meta entry. The entry carries no before/after
  // payload (revert isn't supported for these in V1), so the
  // panel renders the row without a Revert button. Undo still
  // works because the matching state lives in useDiagramHistory.
  const emitTabMeta: Api['emitTabMeta'] = (tabId, summary, opts) => {
    if (!deps.diagramId) return;
    // Same-key repeats (three tweaks of the canvas colour in a row)
    // collapse into one entry carrying the latest summary.
    const key =
      opts?.coalesceKey && opts.undoable !== false
        ? `meta:${tabId}:${opts.coalesceKey}`
        : undefined;
    const target = key ? coalesceTarget(key) : null;
    if (target && key) {
      replaceLogEntry({ ...target, summary, createdAt: Date.now() }, key);
      return;
    }
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
    appendLogEntry(entry, opts, key);
  };

  return { emitChange, emitTabMeta };
}
