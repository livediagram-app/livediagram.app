'use client';

// Publish Roadmap at the owner's tier's limit, with Pro on (docs/specs/026-plan/public-roadmap.md "Tiers", "What the
// dialog shows"): every roadmap the owner may publish is out, so this board can't be until one comes back. It says
// who holds the place (a roadmap of this plan by its title, or a board in another plan), offers the upgrade to the
// owner or a team's admin (Ask an Admin to a team's member), and, when exactly one roadmap of this plan holds a
// place, Publish This One Instead. The numbers are the api's: the list's `usage`, or a refused publish's own.

import { ASK_ADMIN_SENTENCE } from '@liveworkspace/subscription-ui';
import { useId } from 'react';
import { Button } from '@liveworkspace/ui';
import type { PlanTier } from '@/components/tier/plan-tier';
import { TierOfferButton } from '@/components/tier/TierParts';
import {
  ROADMAP_LIMIT_TITLE,
  ROADMAP_NEVER_LIMITED,
  roadmapsFullWords,
  type RoadmapHolder,
} from '@/components/tier/tier-words';

export function RoadmapLimit({
  tier,
  max,
  holder,
  busy,
  onSwap,
}: {
  tier: PlanTier;
  // The most the owner's tier publishes, as the api answered it.
  max: number;
  holder: RoadmapHolder;
  busy: boolean;
  // Publish This One Instead, handed the button to anchor its confirm to. Absent: no one roadmap here to swap with.
  onSwap?: ((anchor: HTMLElement) => void) | undefined;
}) {
  const titleId = useId();
  const words = roadmapsFullWords(max, holder, tier.voice);
  const more = words.offer || (tier.action === 'ask_admin' ? ASK_ADMIN_SENTENCE : '');
  // A plain card, as Planner-Limits shows it: the board can't go out yet, which is a choice to make, not a warning.
  return (
    <section
      role="status"
      aria-labelledby={titleId}
      data-roadmap-limit=""
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-1">
        <h3 id={titleId} className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
          {ROADMAP_LIMIT_TITLE}
        </h3>
        <p className="text-[13px] leading-normal text-slate-600 dark:text-slate-300">
          {words.sentence}
          {more ? ` ${more}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        <TierOfferButton tier={tier} limitKey="publicRoadmaps" size="sm" />
        {onSwap ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={(e) => onSwap(e.currentTarget)}
          >
            Publish This One Instead
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{ROADMAP_NEVER_LIMITED}</p>
    </section>
  );
}
