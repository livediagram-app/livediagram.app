'use client';

// Sprint Planning's Estimate strip above the action bar (docs/specs/026-plan/session-tabs.md "Sprint Planning"): the
// story-point sizes as chips with the card's own pressed, and None. A press writes the card's Estimate at once, as the
// Estimate field does, for whoever may edit cards (an Editor or a Participant, facilitating or not); a Viewer reads the
// value. It says what Commit would make the tally. A card whose type has no Estimate field says so instead.
import {
  ESTIMATE_POINTS,
  builtInFieldLabel,
  estimateOf,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';

const chip =
  'inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md border px-2 text-[13px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
const off =
  'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
const on =
  'border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-200';

// The sizes offered: the story points, with a value the card holds that is not one kept in its place.
export function estimateSizes(current: number | null): number[] {
  const sizes: number[] = [...ESTIMATE_POINTS];
  if (current === null || sizes.includes(current)) return sizes;
  const at = sizes.findIndex((s) => s > current);
  sizes.splice(at === -1 ? sizes.length : at, 0, current);
  return sizes;
}

export function EstimateStrip({
  item,
  type,
  canEdit,
  preview,
  onSet,
}: {
  item: Item;
  type: ItemTypeDef;
  // May write the card's fields (an Editor or a Participant on an unlocked tab).
  canEdit: boolean;
  // What Commit would make the tally ("16 of 30"), for a card still to decide; null hides it.
  preview: string | null;
  onSet: (points: number | null) => void;
}) {
  const label = builtInFieldLabel('estimate', [type], 'Estimate');
  const current = estimateOf(item);
  const shell =
    'flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 sm:px-6 xl:pr-[20rem] dark:border-slate-800 dark:bg-slate-900/60';
  const heading = (
    <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </span>
  );
  if (!type.fields.includes('estimate')) {
    return (
      <div className={shell} data-estimate-strip="">
        {heading}
        <span className="text-[13px] text-slate-500 dark:text-slate-400">
          {type.label} has no Estimate field: this card counts as no estimate.
        </span>
      </div>
    );
  }
  return (
    <div className={shell} data-estimate-strip="">
      {canEdit ? (
        <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
          {heading}
          <span className="w-1" />
          {estimateSizes(current).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={current === n}
              onClick={() => onSet(n)}
              className={`${chip} ${current === n ? on : off}`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={current === null}
            onClick={() => onSet(null)}
            className={`${chip} ${current === null ? on : off}`}
          >
            None
          </button>
        </div>
      ) : (
        <span className="inline-flex items-center gap-2">
          {heading}
          <span className="text-[13px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {current ?? 'None'}
          </span>
        </span>
      )}
      {preview ? (
        <span className="ml-auto text-[12px] text-slate-500 dark:text-slate-400">
          {current === null ? 'No estimate: Commit counts it apart' : 'Commit makes it '}
          {current === null ? null : (
            <b className="font-semibold text-slate-800 dark:text-slate-100">{preview}</b>
          )}
        </span>
      ) : null}
    </div>
  );
}

// A queue row's estimate (docs/specs/026-plan/session-tabs.md "Sprint Planning"): the number in a small pill, or a
// dashed "?" for none, so a missing estimate shows before Commit.
export function EstimatePill({ item }: { item: Item }) {
  const points = estimateOf(item);
  return points === null ? (
    <span
      className="shrink-0 rounded-full border border-dashed border-amber-400 px-1.5 text-[11px] font-medium text-amber-700 dark:border-amber-500 dark:text-amber-400"
      data-estimate-pill="none"
    >
      <span className="text-optical-centre">
        <span aria-hidden>?</span>
        <span className="sr-only">No estimate</span>
      </span>
    </span>
  ) : (
    <span
      className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      data-estimate-pill={points}
    >
      <span className="text-optical-centre">
        {points}
        <span className="sr-only"> {points === 1 ? 'point' : 'points'}</span>
      </span>
    </span>
  );
}
