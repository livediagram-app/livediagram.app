import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { CHANGESET_REVEAL_MS, type ChangesetRoomOp } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import { apiListChangesets, apiRevertChangeset } from '@/lib/api-client';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';
import type { useToast } from '@/hooks/ui/useToast';
import { createRevealStore, type RevealStore } from '@/lib/changeset-reveals';
import { admitChangesetOp, type ChangesetSeen } from './changeset-seen';
import {
  changesetToastCopy,
  coalesceChangesetToast,
  touchedIdsOf,
  undoneCopy,
  type ChangesetToast,
} from './changeset-toast';
import { applyRoomOpToTabs } from './room-op-apply';
import { foldRemoteOpIntoBaseline, type SaveBaselineRefs } from './save-baseline';

// What an editor does with a relayed changeset (docs/specs/024-agents/agent-changesets.md "In the
// editor"; blueprint "The editor"): apply it as a peer's op would be applied, or re-read the tab when
// the relay could not carry it; outline what it touched in its author's colour; and raise one toast
// per burst offering Show and Undo. Undo is a revert, never personal history: applyRemoteOp puts the
// changeset into every undo / redo snapshot too, so Ctrl+Z never takes it back.

export function useChangesetFeed(opts: {
  documentId: string | null;
  selfId: string;
  sessionShareCodeRef: MutableRefObject<string | null>;
  seenRef: MutableRefObject<ChangesetSeen>;
  noteSeen: (tabId: string, rev: number) => void;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  markTabLoaded: (tabId: string) => void;
  // A peer's op into the present and every undo / redo snapshot (historyApplyRemoteOp), so undo
  // never brings back what the peer changed.
  applyRemoteOp: (apply: (prev: Tab[]) => Tab[]) => void;
  saveBaseline: SaveBaselineRefs;
  countAppliedOp: () => void;
  // Re-reads the named tabs from D1 in place (useRoomResync), moving the seen revision with them.
  refetchTabs: (scope: { tabIds: string[] }) => Promise<void>;
  // Brings the named elements of a tab into view (switching to the tab first when needed).
  revealInView: (tabId: string, ids: readonly string[]) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const {
    documentId,
    selfId,
    sessionShareCodeRef,
    seenRef,
    noteSeen,
    loadedTabIdsRef,
    markTabLoaded,
    applyRemoteOp,
    saveBaseline,
    countAppliedOp,
    refetchTabs,
    revealInView,
    toast,
  } = opts;
  const [reveals] = useState<RevealStore>(createRevealStore);
  const toastsRef = useRef(new Map<string, ChangesetToast>());
  // Changesets this editor is undoing: the reverts they relay back raise no toast of their own.
  const undoingRef = useRef(new Set<string>());
  // The latest props, for the toast's buttons, which outlive the render that made them.
  const latest = useRef({ documentId, selfId, toast, revealInView });
  useEffect(() => {
    latest.current = { documentId, selfId, toast, revealInView };
  }, [documentId, selfId, toast, revealInView]);

  // Another document starts clean.
  useEffect(() => {
    toastsRef.current.clear();
    undoingRef.current.clear();
    reveals.clear();
  }, [documentId, reveals]);
  useEffect(() => () => reveals.clear(), [reveals]);

  // The toast and its buttons, built once over refs on the first changeset, so they never go stale.
  const toastActionsRef = useRef<ReturnType<typeof changesetToastActions> | null>(null);

  const receiveChangeset = useCallback(
    (op: ChangesetRoomOp) => {
      const decision = admitChangesetOp(seenRef.current, op, loadedTabIdsRef.current);
      debugLog('[changeset] received', { rev: op.rev, decision });
      if (decision === 'skip') return;
      // Applied as a peer's op, to the tabs on screen and to the save baseline alike
      // (docs/specs/012-collaboration/collab-race-hardening.md), in one batch with the seen revision
      // so a save never claims it before its content is on screen (useChangesetSeen).
      applyRemoteOp((prev) => applyRoomOpToTabs(prev, op));
      foldRemoteOpIntoBaseline(saveBaseline, op);
      countAppliedOp();
      if (op.tab && !loadedTabIdsRef.current.has(op.tabId)) markTabLoaded(op.tabId);
      if (decision === 'apply') noteSeen(op.tabId, op.rev);
      if (decision !== 'apply') {
        debugLog('[changeset] gap-refetch', {
          prevRev: op.prevRev,
          seen: seenRef.current.get(op.tabId) ?? null,
        });
        void refetchTabs({ tabIds: [op.tabId] });
      }
      reveals.add({
        changesetId: op.id,
        tabId: op.tabId,
        color: op.author.color,
        ids: touchedIdsOf(op),
        until: Date.now() + CHANGESET_REVEAL_MS,
      });
      if (op.revertOf && undoingRef.current.has(op.revertOf)) return;
      const entry = coalesceChangesetToast(toastsRef.current, op, Date.now());
      toastsRef.current.set(entry.key, entry);
      toastActionsRef.current ??= changesetToastActions({
        latest,
        toastsRef,
        undoingRef,
        sessionShareCodeRef,
      });
      toastActionsRef.current.show(entry);
    },
    [
      seenRef,
      loadedTabIdsRef,
      applyRemoteOp,
      saveBaseline,
      countAppliedOp,
      markTabLoaded,
      noteSeen,
      refetchTabs,
      reveals,
      sessionShareCodeRef,
    ],
  );

  // On joining the room: a changeset that landed between the tab load and the join was relayed
  // before this editor was there to hear it (a first join replays no log). The newest changesets
  // name any loaded tab this editor is behind on; those are re-read in place. Also covers a relay
  // that never reached the room. Content only: what it brings is outlined and toasted by nothing.
  const checkSinceLoad = useCallback(async () => {
    const { documentId: id, selfId: self } = latest.current;
    if (!id) return;
    try {
      const newest = new Map<string, number>();
      for (const c of await apiListChangesets(self, id, sessionShareCodeRef.current)) {
        newest.set(c.tabId, Math.max(newest.get(c.tabId) ?? 0, c.rev));
      }
      const behind = [...newest]
        .filter(
          ([tabId, rev]) =>
            loadedTabIdsRef.current.has(tabId) && rev > (seenRef.current.get(tabId) ?? 0),
        )
        .map(([tabId]) => tabId);
      if (behind.length === 0) return;
      debugLog('[changeset] join-refetch', { tabs: behind.length });
      await refetchTabs({ tabIds: behind });
    } catch (err) {
      console.warn('[changeset] join-check-failed', { error: String(err) });
    }
  }, [sessionShareCodeRef, loadedTabIdsRef, seenRef, refetchTabs]);

  return { receiveChangeset, checkSinceLoad, reveals };
}

type ToastRefs = {
  latest: MutableRefObject<{
    documentId: string | null;
    selfId: string;
    toast: ReturnType<typeof useToast>;
    revealInView: (tabId: string, ids: readonly string[]) => void;
  }>;
  toastsRef: MutableRefObject<Map<string, ChangesetToast>>;
  undoingRef: MutableRefObject<Set<string>>;
  sessionShareCodeRef: MutableRefObject<string | null>;
};

// The toast of one burst (blueprint "Presentation and UX"): "Webber changed 3 elements: add payment
// service" with Show and Undo. Undo reverts each of its changesets newest first, the buttons
// disabled meanwhile, then reads "Undone" (or how many were kept).
function changesetToastActions(refs: ToastRefs) {
  const show = (entry: ChangesetToast, busy = false) => {
    refs.latest.current.toast.action({
      key: entry.key,
      message: changesetToastCopy(entry),
      actions: [
        {
          label: 'Show',
          ariaLabel: `Show ${entry.name}'s changes`,
          disabled: busy,
          onSelect: () => {
            track('Agent', 'Opened', 'Toast');
            refs.latest.current.revealInView(entry.tabId, entry.touched);
          },
        },
        {
          label: 'Undo',
          ariaLabel: `Undo ${entry.name}'s changes`,
          disabled: busy,
          onSelect: () => void undo(entry),
        },
      ],
    });
  };
  const undo = async (entry: ChangesetToast) => {
    const { documentId, selfId, toast } = refs.latest.current;
    if (!documentId) return;
    show(entry, true);
    for (const id of entry.changesetIds) refs.undoingRef.current.add(id);
    try {
      let kept = 0;
      // Newest first, so each revert meets the tab its successors left.
      for (const id of [...entry.changesetIds].reverse()) {
        const answer = await apiRevertChangeset(
          selfId,
          documentId,
          id,
          refs.sessionShareCodeRef.current,
        );
        kept += answer.kept.length;
      }
      refs.toastsRef.current.delete(entry.key);
      toast.action({ key: entry.key, message: undoneCopy(kept), actions: [] });
    } catch (err) {
      const status = err instanceof Error && 'status' in err ? err.status : null;
      console.warn('[changeset] undo-failed', {
        status: typeof status === 'number' ? status : null,
      });
      show(entry);
      toast.error(`Could not undo ${entry.name}'s change`);
    }
  };
  return { show, undo };
}
