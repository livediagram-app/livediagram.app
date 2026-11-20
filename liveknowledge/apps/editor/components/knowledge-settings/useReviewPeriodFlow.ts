'use client';

// The Review Period's flow in the dialog (docs/specs/030-knowledgebase/verification.md "The Review Period"): a
// longer period, or the same, applies at once; a shorter one is first counted, and asks before it applies when it
// would make more pages due than are due now. Applying is optimistic, undoable from its toast, and put back with a
// toast in words when the server refuses.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReviewEvery } from '@liveknowledge/knowledge';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import { pageKnowledgeStore } from '@/lib/knowledge/page-knowledge-store';
import {
  REVIEW_PERIOD_DOORS,
  applyPeriod,
  previewPeriod,
  type PeriodTarget,
  type ReviewPeriodDoors,
} from '@/lib/knowledge-settings/review-period-change';
import {
  isShorterPeriod,
  periodAppliedText,
  periodFailureText,
} from '@/lib/knowledge-settings/review-period-words';
import { track } from '@/lib/telemetry';
import { useReviewEvery } from './useReviewEvery';

/** A shorter period waiting to be applied: `due` is how many pages it makes due, null while they are counted. */
export type PeriodAsk = { every: ReviewEvery; due: number | null };

export type ReviewPeriodFlow = {
  value: ReviewEvery;
  asked: PeriodAsk | null;
  pick: (every: ReviewEvery) => void;
  apply: () => void;
  cancel: () => void;
};

export function useReviewPeriodFlow(
  doors: ReviewPeriodDoors = REVIEW_PERIOD_DOORS,
): ReviewPeriodFlow {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const value = useReviewEvery(documentId);
  const [asked, setAsked] = useState<PeriodAsk | null>(null);
  // The count in flight: a newer pick, a cancel or the dialog closing ends it.
  const counting = useRef<AbortController | null>(null);
  const stopCounting = useCallback(() => {
    counting.current?.abort();
    counting.current = null;
  }, []);
  useEffect(() => stopCounting, [stopCounting]);

  const targetOf = useCallback((): PeriodTarget | null => {
    const editor = chrome.get();
    if (!editor.documentId) return null;
    return {
      who: { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
      documentId: editor.documentId,
      offline,
      // Each page with the fields just set here, as the tree's marks read them.
      pages: () =>
        chrome.get().tabs.map((tab) => ({ knowledge: pageKnowledgeStore.fieldsOf(tab) })),
    };
  }, [chrome, offline]);

  // Undo, from the applied period's toast: the period it replaced, applied with no further undo offered.
  const undo = useRef<(was: ReviewEvery) => void>(() => {});
  const commit = useCallback(
    (every: ReviewEvery, undoable: boolean) => {
      const target = targetOf();
      if (!target) return;
      // Before it is stored, so the event goes even when the write is refused.
      track('UI', 'Used', 'ReviewPeriodChanged');
      applyPeriod(target, every, Date.now(), doors).then(
        (was) =>
          toast.info(
            periodAppliedText(every),
            undoable && was !== every
              ? {
                  action: {
                    label: 'Undo',
                    ariaLabel: 'Undo the Review Period Change',
                    onSelect: () => undo.current(was),
                  },
                }
              : undefined,
          ),
        (err: unknown) =>
          toast.error(periodFailureText(err instanceof ApiError ? err.status : null)),
      );
    },
    [targetOf, toast, doors],
  );
  useEffect(() => {
    undo.current = (was) => commit(was, false);
  }, [commit]);

  const pick = useCallback(
    (every: ReviewEvery) => {
      stopCounting();
      const target = targetOf();
      if (!target) return;
      const now = doors.store.reviewEveryOf(target.documentId);
      if (every === now) return setAsked(null);
      if (!isShorterPeriod(every, now)) {
        setAsked(null);
        return commit(every, true);
      }
      const control = new AbortController();
      counting.current = control;
      setAsked({ every, due: null });
      previewPeriod(target, every, Date.now(), doors, control.signal).then(
        (count) => {
          if (control.signal.aborted) return;
          counting.current = null;
          // Nothing more comes due: there is nothing to ask.
          if (count.reviewDue <= count.reviewDueNow) {
            setAsked(null);
            commit(every, true);
          } else setAsked({ every, due: count.reviewDue });
        },
        () => {},
      );
    },
    [stopCounting, targetOf, commit, doors],
  );

  const apply = useCallback(() => {
    if (!asked || asked.due === null) return;
    setAsked(null);
    commit(asked.every, true);
  }, [asked, commit]);

  const cancel = useCallback(() => {
    stopCounting();
    setAsked(null);
  }, [stopCounting]);

  return useMemo(
    () => ({ value, asked, pick, apply, cancel }),
    [value, asked, pick, apply, cancel],
  );
}
