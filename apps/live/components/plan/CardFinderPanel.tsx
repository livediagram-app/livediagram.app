'use client';

// The Cards panel (docs/specs/026-plan/items.md "Finding a card"): every live card in the document, of every card
// type (custom ones included), newest change first, searched by number, title, description or type name; **Not on
// a Board** narrows it to the cards no board in the document shows (no column holds the status, or every board
// naming it leaves the card's type out), so strays can be found and put
// somewhere, and the field filters (Card Type among them) narrow it further. Choosing one opens it. A popover above its button in
// Plan mode's bottom-right cluster, like Card Types and the Trash.
import { useMemo, useState } from 'react';
import {
  CARD_FIELDS,
  findCards,
  isOffBoard,
  typeIn,
  itemTitle,
  type BoardStatusTypes,
  type CardFinderShow,
  type Item,
} from '@livediagram/items';
import { CountBadge, EmptyState, PlanCardsIcon, Tooltip, TrashIcon } from '@livediagram/ui';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { usePlan, type PlanContextValue } from './PlanContext';
import { CardSearchControls, useCardSearch } from './CardSearchControls';
import { planPalette, type PlanPalette } from './plan-palette';
import { PlanCardFace } from './PlanCardFace';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

// The most rows drawn at once; a search narrows the rest.
const CARD_FINDER_ROWS_MAX = 200;

const NO_STATUS_TYPES: BoardStatusTypes = new Map();

const SHOWS: { id: CardFinderShow; label: string }[] = [
  { id: 'all', label: 'All Cards' },
  { id: 'off-board', label: 'Not on a Board' },
];

// The list's height, the same however many cards match (the panel never shrinks as a search narrows it). On a
// phone it takes what the screen leaves: less the top bar and the floating toolbar under it (about 7.5rem), the
// dock under the panel (about 4.5rem) and the panel's own heading, search, tabs and filters (about 13rem), so
// the panel's top never runs under the toolbar.
const LIST_HEIGHT = 'h-[min(60vh,32rem)] max-sm:h-[max(7rem,calc(100dvh-25rem))]';

export function CardFinderPanel({
  popoverAnchor,
  onPopoverClose,
}: {
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const plan = usePlan();
  // The cards' colours, as the boards on this canvas draw them.
  const palette = planPalette(useCanvasSurface());
  const [show, setShow] = useState<CardFinderShow>('all');
  // Focused on open with a mouse; on a phone the keyboard waits until the field is tapped.
  const [finePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches,
  );
  const boardStatuses = plan?.statusTypes ?? NO_STATUS_TYPES;
  const live = useMemo(
    () => findCards(plan?.items.values() ?? [], { query: '', show: 'all', boardStatuses }),
    [plan?.items, boardStatuses],
  );
  if (!plan) return null;
  return (
    <CardFinderBody
      plan={plan}
      live={live}
      show={show}
      setShow={setShow}
      boardStatuses={boardStatuses}
      finePointer={finePointer}
      palette={palette}
      popoverAnchor={popoverAnchor}
      onPopoverClose={onPopoverClose}
    />
  );
}

function CardFinderBody({
  plan,
  live,
  show,
  setShow,
  boardStatuses,
  finePointer,
  palette,
  popoverAnchor,
  onPopoverClose,
}: {
  plan: PlanContextValue;
  live: Item[];
  show: CardFinderShow;
  setShow: (s: CardFinderShow) => void;
  boardStatuses: BoardStatusTypes;
  finePointer: boolean;
  palette: PlanPalette;
  popoverAnchor?: DockAnchor;
  onPopoverClose: () => void;
}) {
  const search = useCardSearch(plan, live, { show, boardStatuses });
  const { filtered: ofTypes, found, query, filters } = search;
  const counts = {
    all: ofTypes.length,
    'off-board': ofTypes.filter((it) => isOffBoard(it, boardStatuses)).length,
  };
  return (
    <MovablePanel
      title="Cards"
      helpArticle="planCards"
      position={null}
      defaultCorner="bottom-right"
      width="w-[calc(100vw-2rem)] sm:w-[44rem]"
      onMoveTo={() => {}}
      popoverOpen
      popoverAnchor={popoverAnchor}
      asPopover
      popoverWidth="w-[calc(100vw-2rem)] sm:w-[44rem]"
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="flex flex-col gap-2.5 px-3 pb-3">
        <CardSearchControls plan={plan} live={live} search={search} autoFocus={finePointer}>
          <div
            role="radiogroup"
            aria-label="Which cards"
            className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
          >
            {SHOWS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={show === s.id}
                onClick={() => setShow(s.id)}
                className={`flex ${s.id === 'all' ? 'min-w-0 flex-1' : 'shrink-0 whitespace-nowrap px-4'} items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition ${
                  show === s.id
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {s.label}
                <CountBadge
                  size="md"
                  background={s.id === 'off-board' && counts[s.id] ? '#d9770626' : '#64748b26'}
                  color={s.id === 'off-board' && counts[s.id] ? '#b45309' : '#64748b'}
                >
                  {counts[s.id]}
                </CountBadge>
              </button>
            ))}
          </div>
        </CardSearchControls>
        {found.length === 0 ? (
          // The shared empty state, as the Trash's, filling the list's fixed height.
          <div className={`flex ${LIST_HEIGHT} flex-col [&>div]:flex-1`}>
            <EmptyState
              icon={<PlanCardsIcon size={18} />}
              {...emptyCopy(live.length, query, filters.length)}
            />
          </div>
        ) : (
          <ul
            aria-label="Cards"
            // The same height however many cards: the panel never shrinks as a search narrows it.
            className={`flex ${LIST_HEIGHT} flex-col gap-1.5 overflow-y-auto p-0.5`}
          >
            {found.slice(0, CARD_FINDER_ROWS_MAX).map((it) => {
              const type = typeIn(plan.types, it.type);
              return (
                <li key={it.id} className="group/row flex items-center gap-2 pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      onPopoverClose();
                      plan.openItem(it.id);
                    }}
                    aria-label={`Open ${itemTitle(it) || 'Untitled'}, ${type.label} #${it.key}`}
                    className="min-w-0 flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    {/* The card as a board draws it at Compact size, laid out as its type's Display says. */}
                    <PlanCardFace item={it} palette={palette} fields={CARD_FIELDS} size="compact" />
                  </button>
                  {plan.canEdit ? (
                    <Tooltip label="Move to Trash">
                      <button
                        type="button"
                        aria-label={`Move #${it.key} to the Trash`}
                        onClick={() => {
                          plan.trashItem(it.id);
                          plan.announce(`#${it.key} moved to the Trash`);
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/row:opacity-100"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </Tooltip>
                  ) : null}
                </li>
              );
            })}
            {found.length > CARD_FINDER_ROWS_MAX ? (
              <li className="px-2 py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                Showing {CARD_FINDER_ROWS_MAX} of {found.length}. Search to narrow them down.
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </MovablePanel>
  );
}

// What the list says when it shows no cards (docs/specs/026-plan/items.md "Find a card"): a title and a line,
// as every empty state.
export function emptyCopy(
  cards: number,
  query: string,
  filters: number,
): { title: string; description: string } {
  if (cards === 0)
    return {
      title: 'No cards yet',
      description: 'Add one from a board, or drag one in from the palette.',
    };
  if (query.trim())
    return { title: 'No cards match', description: 'Try another word, a number or a card type.' };
  if (filters > 0)
    return {
      title: 'No cards match these filters',
      description: 'Remove a filter, or clear the search, to see more.',
    };
  return { title: 'Every card is on a board', description: 'None of them sits off a board here.' };
}
