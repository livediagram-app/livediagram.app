// The Q&A board's runtime (docs/specs/012-collaboration/qa-board.md): send an action to the server, show it
// under the finger before the server answers, and land the server's word when
// it arrives, from the response or from the room.
//
// The server owns the board, so nothing here writes it for real. What it does
// write is a LOCAL view: the last authoritative state with this browser's
// still-in-flight actions replayed on top. That replay is what keeps two quick
// votes from flickering: the first vote's broadcast lands while the second is
// still in flight, and without the queue it would briefly erase the second.
//
// Both kinds of write go through `applyRemoteTabs` and into the autosave's
// baseline too, the same path a peer's op takes (docs/specs/012-collaboration/collab-race-hardening.md), so the autosave
// never mistakes the server's word for a local edit. An optimistic copy keeps the rev it
// was built on, so even if it did reach an autosave or an `el` op the
// rev-merge (preferNewerQa) would refuse it everywhere else.

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import {
  applyQaAction,
  isParticipantQaAction,
  QA_MAX_NOTES,
  qaVoterId,
  type QaAction,
  type QaActor,
  type QaNote,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { apiQaAction } from '@/lib/api-client';
import { isVoteLimitError, VOTE_LIMIT_MESSAGE } from '@/lib/vote-limit';
import type { Participant } from '@/lib/identity';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

type Pending = { seq: number; action: QaAction; actor: QaActor };

// What a post the server refused at the cap says (docs/specs/012-collaboration/qa-board.md "The face", Adding).
export const QA_BOARD_FULL_MESSAGE = 'The board filled up before your note landed.';
type Base = { notes: QaNote[]; rev: number };

const keyOf = (tabId: string, elementId: string) => `${tabId}\u0000${elementId}`;

export function useQaBoard({
  documentId,
  activeId,
  selfParticipant,
  sessionShareCode,
  applyRemoteTabs,
  commitTabs,
  lastSavedTabsRef,
  onError,
}: {
  documentId: string | null;
  activeId: string;
  selfParticipant: Participant;
  sessionShareCode: string | null;
  applyRemoteTabs: (updater: (prev: Tab[]) => Tab[]) => void;
  // The persisting write, used only for an offline document (docs/specs/006-document/offline-mode.md), where
  // there is no server and the ordinary tab save is the store.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  // The autosave's baseline (docs/specs/012-collaboration/collab-race-hardening.md). The board is the server's, so its
  // view lands here as well as on screen and is never saved back as ours.
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  onError: (message: string) => void;
}) {
  const pendingRef = useRef(new Map<string, Pending[]>());
  const baseRef = useRef(new Map<string, Base>());
  const seqRef = useRef(0);
  // Read through refs so `receiveQa` can stay stable: the room connection
  // takes it once and must not reopen the socket when these change.
  const selfRef = useRef(selfParticipant);
  const writersRef = useRef({ applyRemoteTabs, commitTabs });
  useEffect(() => {
    selfRef.current = selfParticipant;
    writersRef.current = { applyRemoteTabs, commitTabs };
  });

  // Rebuild one board's local view: its newest known authoritative state,
  // with our in-flight actions replayed over it.
  const rebuild = useCallback(
    (tabId: string, elementId: string, persist = false) => {
      const key = keyOf(tabId, elementId);
      const updater = (tabs: Tab[]): Tab[] => {
        let changed = false;
        const next = tabs.map((tab) => {
          if (tab.id !== tabId) return tab;
          const elements = tab.elements.map((el) => {
            if (el.id !== elementId || el.type !== 'shape' || el.shape !== 'qa-board') return el;
            // A newer rev on the element than our base means it arrived by
            // another road (a hydrate, a resync, a peer's `tab` op), and it
            // is the truer base.
            let base = baseRef.current.get(key);
            if (!base || (el.qaRev ?? 0) > base.rev) {
              base = { notes: el.qaNotes ?? [], rev: el.qaRev ?? 0 };
              baseRef.current.set(key, base);
            }
            const notes = (pendingRef.current.get(key) ?? []).reduce(
              (acc, p) => applyQaAction(acc, p.action, p.actor),
              base.notes,
            );
            if (notes === el.qaNotes && base.rev === (el.qaRev ?? 0)) return el;
            changed = true;
            return { ...el, qaNotes: notes, qaRev: base.rev } satisfies ShapeElement;
          });
          return changed ? { ...tab, elements } : tab;
        });
        return changed ? next : tabs;
      };
      if (persist) {
        writersRef.current.commitTabs(updater);
      } else {
        writersRef.current.applyRemoteTabs(updater);
        lastSavedTabsRef.current = updater(lastSavedTabsRef.current);
      }
    },
    [lastSavedTabsRef],
  );

  // The server's word on a board, from the room's `qa` op or our own
  // response. Older than what we hold = already superseded, ignored.
  const receiveQa = useCallback(
    (tabId: string, elementId: string, notes: QaNote[], rev: number) => {
      const key = keyOf(tabId, elementId);
      const base = baseRef.current.get(key);
      if (base && base.rev >= rev) return;
      baseRef.current.set(key, { notes, rev });
      rebuild(tabId, elementId);
    },
    [rebuild],
  );

  // Resolves false only when the server's answer leaves out a note this browser just added: the board filled
  // up between this viewer's last look and the post (docs/specs/012-collaboration/qa-board.md "The face", Adding).
  const run = async (element: ShapeElement, action: QaAction): Promise<boolean> => {
    const tabId = activeId;
    const key = keyOf(tabId, element.id);
    const self = selfRef.current;
    const actor: QaActor = {
      voterId: await qaVoterId(self.id, element.id),
      author: { name: self.name, color: self.color },
      now: Date.now(),
    };
    if (!baseRef.current.has(key)) {
      baseRef.current.set(key, { notes: element.qaNotes ?? [], rev: element.qaRev ?? 0 });
    }
    const entry: Pending = { seq: ++seqRef.current, action, actor };
    pendingRef.current.set(key, [...(pendingRef.current.get(key) ?? []), entry]);
    rebuild(tabId, element.id);
    track('Element', 'Changed', 'Qa-board');

    const settle = () => {
      const left = (pendingRef.current.get(key) ?? []).filter((p) => p.seq !== entry.seq);
      if (left.length) pendingRef.current.set(key, left);
      else pendingRef.current.delete(key);
    };

    // No document yet, or an offline one: there is no server, so the action is
    // applied for real here and the tab save carries it.
    const applyLocally = () => {
      const base = baseRef.current.get(key)!;
      baseRef.current.set(key, {
        notes: applyQaAction(base.notes, action, actor),
        rev: base.rev + 1,
      });
      settle();
      rebuild(tabId, element.id, true);
    };
    if (!documentId) {
      applyLocally();
      return true;
    }
    try {
      const state = await apiQaAction(
        self.id,
        documentId,
        tabId,
        element.id,
        action,
        sessionShareCode,
      );
      if (!state) {
        applyLocally();
        return true;
      }
      settle();
      const base = baseRef.current.get(key);
      if (!base || state.rev > base.rev) baseRef.current.set(key, state);
      rebuild(tabId, element.id);
      // The server answers a refused add with the board as it stands, its note missing. Only a full board
      // refuses a well-formed add, so that is what the person is told; the composer puts the draft back.
      if (action.type === 'add' && !state.notes.some((n) => n.id === action.id)) {
        debugLog('[qa] add.refused_full', { notes: state.notes.length });
        onError(QA_BOARD_FULL_MESSAGE);
        return false;
      }
      return true;
    } catch (err) {
      settle();
      rebuild(tabId, element.id);
      onError(
        isVoteLimitError(err)
          ? VOTE_LIMIT_MESSAGE
          : isParticipantQaAction(action)
            ? 'That didn’t reach the board. Try again in a moment.'
            : 'Couldn’t update the board. Try again in a moment.',
      );
      return true;
    }
  };

  return {
    receiveQa,
    // Whether the note went in: false at once when the board is full as this viewer sees it
    // (QA_MAX_NOTES), else a promise of the server's word, false when the board filled up meanwhile.
    // Either way a refused draft goes back in the composer.
    addQaNote: (
      element: ShapeElement,
      text: string,
      anonymous: boolean,
    ): boolean | Promise<boolean> => {
      if ((element.qaNotes ?? []).length >= QA_MAX_NOTES) return false;
      return run(element, { type: 'add', id: crypto.randomUUID(), text, anonymous });
    },
    voteQaNote: (element: ShapeElement, noteId: string, on: boolean) =>
      void run(element, { type: 'vote', noteId, on }),
    discussQaNote: (element: ShapeElement, noteId: string | null) =>
      void run(element, { type: 'discuss', noteId }),
    closeQaNote: (element: ShapeElement, noteId: string) =>
      void run(element, { type: 'done', noteId }),
    reopenQaNote: (element: ShapeElement, noteId: string) =>
      void run(element, { type: 'reopen', noteId }),
    removeQaNote: (element: ShapeElement, noteId: string) =>
      void run(element, { type: 'remove', noteId }),
    clearQaBoard: (element: ShapeElement) => void run(element, { type: 'clear' }),
  };
}
