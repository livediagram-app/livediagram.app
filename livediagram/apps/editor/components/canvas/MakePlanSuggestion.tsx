'use client';

// Make These a Plan (docs/specs/013-workspace/suggestions.md; liveworkspace/docs/specs/016-notifications/suggestions.md):
// 3 or more action stickies on the tab shown offer Send to Plan's picker on all of them, one card each. The check reads
// the tab's elements from a ref when the page is idle, never on a render, an edit or a drag. An Editor's alone, in a
// session that may send.
import { useCallback, useEffect, useRef } from 'react';
import { NextAppSuggestion } from '@liveworkspace/workbench/components/suggest/NextAppSuggestion';
import { sendElements } from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import { canSendHere } from '@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry';
import { ACTION_STICKIES_MIN, actionStickies } from '@/lib/action-stickies';

type Placed = Parameters<typeof actionStickies>[0][number] & { label?: unknown };

export function MakePlanSuggestion({
  itemId,
  allowed,
  elements,
}: {
  itemId: string | null;
  allowed: boolean;
  elements: readonly Placed[];
}) {
  const latest = useRef(elements);
  useEffect(() => {
    latest.current = elements;
  }, [elements]);
  const check = useCallback(() => {
    if (!canSendHere()) return null;
    const found = actionStickies(latest.current);
    if (found.length < ACTION_STICKIES_MIN) return null;
    return {
      line: `${found.length} action stickies here could be cards in a liveplanner plan, one each.`,
      run: () => sendElements(found),
    };
  }, []);
  return <NextAppSuggestion id="make-plan" itemId={itemId} allowed={allowed} check={check} />;
}
