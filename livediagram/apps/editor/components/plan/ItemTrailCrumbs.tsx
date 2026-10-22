'use client';

// The item panel header's breadcrumb (docs/specs/026-plan/plan-board.md "Breadcrumb", "The header reads part by
// part"): the cards opened before this one from inside the panel, nearest last, each a link back. Earlier ones past
// what fits fold into a "…" button whose menu lists them. Draws nothing for a trail of one card.
import { useState } from 'react';
import { itemTitle, typeIn, type Item, type ItemTypeDef } from '@livediagram/items';
import { ChevronLeftIcon, ChevronRightIcon, Tooltip } from '@livediagram/ui';
import { PortalMenu, MenuActionRow } from '@/components/primitives/PortalMenu';
import { PlanTypeGlyph } from './plan-type-glyph';
import { ACCENT_TEXT, accentVars } from './plan-palette';
import { ITEM_TRAIL_SHOWN, ITEM_TRAIL_SHOWN_PHONE, visibleTrail } from './item-trail';

function Separator() {
  return (
    <span aria-hidden className="mx-1 shrink-0 text-slate-300 dark:text-slate-600">
      <ChevronRightIcon size={12} />
    </span>
  );
}

const backLabel = (crumb: Item) => `Back to #${crumb.key} ${itemTitle(crumb)}`;

function TypeGlyph({
  item,
  types,
  size,
}: {
  item: Item;
  types: readonly ItemTypeDef[];
  size: number;
}) {
  const type = typeIn(types, item.type);
  return (
    <span className={`shrink-0 ${ACCENT_TEXT}`} style={accentVars(type.color)}>
      <PlanTypeGlyph glyph={type.glyph} size={size} />
    </span>
  );
}

// The folded earlier cards: a "…" that names how many, opening a menu of them.
function FoldedCrumbs({
  folded,
  types,
  onBack,
}: {
  folded: readonly Item[];
  types: readonly ItemTypeDef[];
  onBack: (itemId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const label = folded.length === 1 ? '1 earlier card' : `${folded.length} earlier cards`;
  return (
    <>
      <Tooltip label={label}>
        <button
          ref={setButton}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-md px-1 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50"
        >
          <span aria-hidden>…</span>
        </button>
      </Tooltip>
      {open ? (
        <PortalMenu anchor={button} placement="below-start" onClose={() => setOpen(false)}>
          {folded.map((crumb) => (
            <MenuActionRow
              key={crumb.id}
              plain
              label={backLabel(crumb)}
              icon={<TypeGlyph item={crumb} types={types} size={14} />}
              onClick={() => {
                setOpen(false);
                onBack(crumb.id);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </>
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
            <FoldedCrumbs folded={earlier.slice(0, folded)} types={types} onBack={onBack} />
            <Separator />
          </li>
        ) : null}
        {crumbs.map((crumb) => {
          const name = backLabel(crumb);
          return (
            <li key={crumb.id} className="flex min-w-0 items-center">
              <Tooltip label={name}>
                <button
                  type="button"
                  aria-label={name}
                  onClick={() => onBack(crumb.id)}
                  className={`group flex min-w-0 cursor-pointer ${mobile ? 'max-w-full' : 'max-w-[11rem]'} items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50`}
                >
                  {/* A phone's row of its own: the crumb points back, with nothing after it. */}
                  {mobile ? (
                    <span aria-hidden className="-ml-0.5 shrink-0 text-slate-400">
                      <ChevronLeftIcon size={12} />
                    </span>
                  ) : null}
                  <TypeGlyph item={crumb} types={types} size={13} />
                  <span className="min-w-0 truncate font-medium underline-offset-2 group-hover:underline">
                    {itemTitle(crumb)}
                  </span>
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
