'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@liveworkspace/ui';
import {
  TopCenterBanner,
  TopCenterRow,
} from '@liveworkspace/workbench/components/chrome/TopCenter';
import {
  confirmHeldChanges,
  heldCardCount,
  keepHeldCards,
  subscribeWaitingChanges,
} from '@/lib/offline-queue/plan-queue';
import { heldCopy } from '@/lib/offline-queue/removal-held';

const noneHeld = () => 0;

// The Needs Review banner (docs/specs/007-editor/offline-changes.md "Held for review"): card removals the server held
// because they would take many cards off a board at once wait here, still shown as made, until the person keeps the
// cards or removes them anyway. Neutral, never red (docs/specs/004-interface-design/destructive-actions.md): nothing
// went wrong, it is a check. Only an Editor removes cards, so a read-only session never sees it.
export function HeldRemovalsBanner({ readOnly }: { readOnly: boolean }) {
  const held = useSyncExternalStore(subscribeWaitingChanges, heldCardCount, noneHeld);
  if (readOnly || held === 0) return null;
  return (
    <TopCenterRow>
      {/* A card, not a pill (the offline banner's look): the line wraps inside its corners, and the buttons sit after
          it, or wrap under it at the right when both do not fit (a phone, a ~450 px window). */}
      <TopCenterBanner
        tone="neutral"
        shape="card"
        className="max-w-[48rem] flex-wrap justify-end gap-x-3 gap-y-1 p-1.5 pl-3.5 text-[11px] font-medium"
      >
        <span role="status" className="min-w-0 flex-[1_1_16rem] py-1 leading-snug">
          {heldCopy(held)}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            className="rounded-full"
            title="Drop the held removals and bring the cards back"
            onClick={keepHeldCards}
          >
            Keep Cards
          </Button>
          <Button
            variant="primary"
            size="xs"
            className="rounded-full"
            title="Send the held removals again, confirmed"
            onClick={confirmHeldChanges}
          >
            Remove Anyway
          </Button>
        </span>
      </TopCenterBanner>
    </TopCenterRow>
  );
}
