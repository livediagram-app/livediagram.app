'use client';

// A source's chip for its card (liveworkspace/docs/specs/004-index/send-to-plan.md "The chip"): the card's column and
// plan, a tick once it is done, the newest card when there are several with "+N" for the rest. Clicking opens the card in
// liveplanner in a new browser tab. Live: the store reads again when the plan says its card changed.
import type { PlanSend } from '@liveworkspace/index-client';
import { HoverCard, lucideGlyph } from '@liveworkspace/ui';
import { lucideCircleCheck, lucideSquareKanban } from '@liveworkspace/icons/lucide';
import { workbench } from '../../bindings';

const CardGlyph = lucideGlyph(lucideSquareKanban, 13);
const DoneGlyph = lucideGlyph(lucideCircleCheck, 13);

/** The chip's words: "To Do · Sprint 12", or "Done · Sprint 12". */
export const chipWords = (send: PlanSend): string =>
  `${send.card.column || 'Card'} · ${send.plan.title || 'Untitled plan'}`;

/** Opens a sent card in liveplanner, in a new browser tab. */
export function openSentCard(send: PlanSend): void {
  workbench.track('UI', 'Opened', 'SentCard');
  window.open(send.link, '_blank', 'noopener,noreferrer');
}

export function SentChip({
  sends,
  className = '',
}: {
  sends: readonly PlanSend[];
  className?: string;
}) {
  const newest = sends[0];
  if (!newest) return null;
  const done = newest.card.done;
  const more = sends.length - 1;
  const words = chipWords(newest);
  return (
    <HoverCard
      title={newest.card.title || 'Card'}
      description={`${words}${more > 0 ? `, and ${more} more card${more === 1 ? '' : 's'}` : ''}. Opens in liveplanner.`}
    >
      <button
        type="button"
        data-sent-chip=""
        data-done={done ? '' : undefined}
        aria-label={`Open the card “${newest.card.title}”, ${done ? 'done, ' : ''}${words}, in liveplanner`}
        onClick={(e) => {
          e.stopPropagation();
          openSentCard(newest);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`inline-flex h-6 max-w-56 min-w-0 cursor-pointer items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
          done
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
        } ${className}`}
      >
        <span className="shrink-0" aria-hidden>
          {done ? <DoneGlyph /> : <CardGlyph />}
        </span>
        <span className="min-w-0 truncate">{words}</span>
        {more > 0 ? <span className="shrink-0 tabular-nums opacity-70">+{more}</span> : null}
      </button>
    </HoverCard>
  );
}
