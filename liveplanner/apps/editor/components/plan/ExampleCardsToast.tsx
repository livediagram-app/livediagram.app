'use client';

// The example cards toast (docs/specs/026-plan/plan-templates.md "Example cards"): a standing toast while the project
// holds example cards a board on screen shows, "Example cards show how this board runs." with Clear, which sends every
// example card of the project to the Trash (one write, one undo step). An Editor's alone: a Participant may not trash
// others' cards (docs/specs/013-workspace/share-roles.md), and a Viewer only looks. One toast, by its key, however
// many boards show example cards; closing it hides it until the plan is opened again.
import { useEffect, useRef } from 'react';
import { isExampleItem, isTrashed, type Item } from '@liveplanner/items';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';
import type { PlanContextValue } from './PlanContext';

export const EXAMPLE_CARDS_TOAST_KEY = 'example-cards';
export const EXAMPLE_CARDS_MESSAGE = 'Example cards show how this board runs.';

// The project's example cards still on a board (not in the Trash).
export function exampleCardIds(items: Iterable<Item>): string[] {
  const ids: string[] = [];
  for (const item of items) if (isExampleItem(item) && !isTrashed(item)) ids.push(item.id);
  return ids;
}

// Boards on screen asking for the toast, so one board leaving does not take it from another; and whether the person
// closed it on this page.
let asking = 0;
let closedOnPage = false;

/** Forget the page's state (tests). */
export function resetExampleCardsToastForTests(): void {
  asking = 0;
  closedOnPage = false;
}

export function ExampleCardsToast({
  shown,
  plan,
}: {
  // The cards this board shows: it asks for the toast while one is an example card.
  shown: readonly Item[];
  plan: Pick<PlanContextValue, 'items' | 'canEdit' | 'trashItems' | 'announce'>;
}) {
  const toast = useToast();
  const wanted = plan.canEdit && shown.some(isExampleItem);
  // The latest plan, read when Clear is pressed, so a change to the cards does not re-raise the toast.
  const latest = useRef(plan);
  useEffect(() => {
    latest.current = plan;
  });
  useEffect(() => {
    if (!wanted) return;
    asking += 1;
    if (!closedOnPage) {
      toast.action({
        key: EXAMPLE_CARDS_TOAST_KEY,
        message: EXAMPLE_CARDS_MESSAGE,
        sticky: true,
        actions: [
          {
            label: 'Clear',
            ariaLabel: 'Clear Example Cards',
            onSelect: () => {
              // Sent first, so the event reaches the wire whatever the write does.
              track('Plan', 'Deleted', 'ExampleCards');
              const { items, trashItems, announce } = latest.current;
              const went = trashItems(exampleCardIds(items.values()));
              announce(
                `${went === 1 ? '1 example card' : `${went} example cards`} moved to the Trash`,
              );
            },
          },
        ],
        onDismiss: () => {
          closedOnPage = true;
        },
      });
    }
    return () => {
      asking -= 1;
      // A tick later, so a board that mounts straight after (a tab switch, a remount) keeps the same toast in place.
      setTimeout(() => {
        if (asking === 0) toast.dismissAction(EXAMPLE_CARDS_TOAST_KEY);
      }, 0);
    };
  }, [wanted, toast]);
  return null;
}
