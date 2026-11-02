'use client';

// The Vote set-up's Count In choices for the open tab (docs/specs/012-collaboration/session-tools.md "Count In"): the
// Votes fields its boards' card types offer, the built-in first; empty when only the built-in is there.
import { useMemo } from 'react';
import {
  normaliseBoardSetup,
  voteCountInChoices,
  type VoteCountInChoice,
} from '@liveplanner/items';
import { useEditorContext } from '@/app/project/[id]/EditorContext';

export function useVoteCountIn(): VoteCountInChoice[] {
  const { activeTab, plan } = useEditorContext();
  const elements = activeTab.elements;
  const types = plan.context.types;
  return useMemo(
    () =>
      voteCountInChoices(
        elements
          .filter((e) => e.type === 'shape' && e.shape === 'plan-board')
          .map((e) => normaliseBoardSetup((e as { planBoard?: unknown }).planBoard)),
        types,
      ),
    [elements, types],
  );
}
