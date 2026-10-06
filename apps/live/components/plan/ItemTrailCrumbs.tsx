'use client';

// The item panel header's breadcrumb (docs/specs/026-plan/plan-board.md "Breadcrumb"): the cards opened
// before this one from inside the panel, nearest last, each a step back. Earlier ones past what fits fold
// into "…"; stepping back brings them into view. Draws nothing for a trail of one card.
import { itemTitle, typeIn, type Item, type ItemTypeDef } from '@livediagram/items';
import { ChevronLeftIcon, ChevronRightIcon, Tooltip } from '@livediagram/ui';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';
import { ITEM_TRAIL_SHOWN, ITEM_TRAIL_SHOWN_PHONE, visibleTrail } from './item-trail';

function Separator() {
  return (
    <span aria-hidden className="mx-0.5 shrink-0 text-slate-300 dark:text-slate-600">
      <ChevronRightIcon size={12} />
    </span>
  );
}

export function ItemTrailCrumbs({
  trail,
  types,
  mobile,
  onBack,
}: {
  // The trail ending on the open card (liveTrail in item-trail.ts).
  trail: readonly Item[];
  types: readonly ItemTypeDef[];
  mobile: boolean;
  onBack: (itemId: string) => void;
}) {
  const earlier = trail.slice(0, -1);
  if (earlier.length === 0) return null;
  const { folded, crumbs } = visibleTrail(
    earlier,
    mobile ? ITEM_TRAIL_SHOWN_PHONE : ITEM_TRAIL_SHOWN,
  );
  return (
    <nav aria-label="Card trail" className="flex min-w-0 shrink items-center">
      <ol className="flex min-w-0 items-center">
        {folded > 0 ? (
          <li className="flex shrink-0 items-center">
            <span className="rounded-md px-1 text-[13px] font-medium text-slate-400">
              <span aria-hidden>…</span>
              <span className="sr-only">
                {folded === 1 ? '1 earlier card' : `${folded} earlier cards`}
              </span>
            </span>
            {mobile ? null : <Separator />}
          </li>
        ) : null}
        {crumbs.map((crumb) => {
          const type = typeIn(types, crumb.type);
          const name = `Back to #${crumb.key} ${itemTitle(crumb)}`;
          return (
            <li key={crumb.id} className="flex min-w-0 items-center">
              <Tooltip label={name}>
                <button
                  type="button"
                  aria-label={name}
                  onClick={() => onBack(crumb.id)}
                  className={`group flex min-w-0 ${mobile ? 'max-w-full' : 'max-w-[11rem]'} items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50`}
                >
                  {/* A phone's row of its own: the crumb points back, with nothing after it. */}
                  {mobile ? (
                    <span aria-hidden className="-ml-0.5 shrink-0 text-slate-400">
                      <ChevronLeftIcon size={12} />
                    </span>
                  ) : null}
                  <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
                    <PlanTypeGlyph glyph={type.glyph} size={13} />
                  </span>
                  <span className="shrink-0 tabular-nums">#{crumb.key}</span>
                  <span className="min-w-0 truncate font-medium">{itemTitle(crumb)}</span>
                </button>
              </Tooltip>
              {mobile ? null : <Separator />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
