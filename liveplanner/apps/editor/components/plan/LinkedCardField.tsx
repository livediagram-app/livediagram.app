'use client';

// A link field's control in the card panel (docs/specs/026-plan/item-types.md "Card fields"): the built-in Parent
// and every Card field use this one control. One bordered field the full width of its row: the linked card's glyph
// in its type's colour (and its own colour dot), its number as a quiet tag and its full title, a chevron to choose,
// and an open arrow at the end, inside the same border, that opens the linked card. Choosing drops a list under
// the field, drawn over the page (AnchoredPopover) so the side column never squeezes it: at least LINK_LIST_MIN_PX
// wide, wider with the field, kept on screen. A filter, None, then the candidate cards, each title on up to two
// lines with the whole title in a tooltip. Keys: Enter or Space opens it, the arrows move, Enter picks, Escape
// closes. A Card field that holds several (docs/specs/026-plan/item-types.md "Holds Several") draws its cards as chips
// (FieldChips: each opens its card) and its list toggles: a pick links a card, picking one linked unlinks it, and the
// list stays open for more. A Blocked By field (item-types.md "Blocked By") never adds a card that already waits on
// this one: the pick leaves the field as it was and says why, and such a card reads "Waits on this card" in the list.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  blockingLoop,
  blockingLoopMessage,
  cardKey,
  fieldCardIds,
  itemColourOf,
  itemTitle,
  linkedCard,
  severalValue,
  toggledValues,
  typeIn,
  waitingOn,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, NoMatches, Tooltip } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { PlanTypeGlyph } from './plan-type-glyph';
import { planColourName } from './ColourSwatches';
import { ACCENT_TEXT, accentVars } from './plan-palette';
import { FieldChips } from './FieldChips';
import { usePlan } from './PlanContext';

// A field holding several, as several-values.ts reads it.
const SEVERAL = { kind: 'card', multiple: true } as const;

// More candidates than this and the list opens with a filter.
export const LINK_FILTER_FROM = 8;
// The list's least width (20rem): room for a card's number and a title of a few words on a line, however narrow
// the field (docs/specs/026-plan/item-types.md "Card fields"). A wider field widens it; the window caps it.
export const LINK_LIST_MIN_PX = 320;

export function LinkedCardField({
  id,
  label,
  value,
  candidates,
  items,
  types,
  disabled,
  onSave,
  onOpen,
  multiple = false,
  blocksFor,
}: {
  id: string;
  // The field's name: the control's accessible name ("Parent", "Owner").
  label: string;
  value: unknown;
  // The cards it may point at (linkCandidates): live cards of the linked type, never the card itself.
  candidates: readonly Item[];
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  disabled: boolean;
  onSave: (next: string | string[] | undefined) => void;
  // Opens the linked card; absent (a card not made yet, the New {Type} dialog), there is no open arrow.
  onOpen?: (itemId: string) => void;
  // A Card field that holds several: its cards as chips, the list toggling them.
  multiple?: boolean;
  // A Blocked By field's card: a pick that would close a loop through it is refused.
  blocksFor?: string;
}) {
  const plan = usePlan();
  const announce = plan?.announce;
  // The chain a card would close as this card's blocker, when it already waits on it; null otherwise.
  const loopOf = (card: Item) =>
    blocksFor ? blockingLoop(items, types, blocksFor, card.id) : null;
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // The list's width, taken from the field as it opens.
  const [listWidth, setListWidth] = useState(LINK_LIST_MIN_PX);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // The cards it links to: every one when it holds several, else the first (a stored list reads as its first).
  const chosen = fieldCardIds(multiple ? SEVERAL : undefined, value);
  const linkedId = multiple ? undefined : chosen[0];
  const held = (card: Item | undefined) =>
    multiple ? !!card && chosen.includes(card.id) : (card?.id ?? undefined) === linkedId;
  const cardOf = (id: string) => linkedCard(items, id) ?? candidates.find((c) => c.id === id);
  // The linked card, from the project's cards, else from the candidates (a host that passes only those).
  const linked = linkedId
    ? (linkedCard(items, linkedId) ?? candidates.find((c) => c.id === linkedId))
    : undefined;
  const missing = !!linkedId && !linked;
  const name = linked ? `#${linked.key} ${itemTitle(linked)}` : missing ? 'Missing card' : 'None';

  // None first, then the candidates matching the filter (by number or title, ignoring case).
  const options = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '');
    const list = q
      ? candidates.filter(
          (c) => String(c.key).startsWith(q) || itemTitle(c).toLowerCase().includes(q),
        )
      : candidates;
    return (multiple ? list : [undefined, ...list]) as (Item | undefined)[];
  }, [candidates, query, multiple]);

  const close = (refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (card: Item | undefined) => {
    // Several: a card toggles and the list stays open for more.
    if (multiple) {
      const loop = card && !chosen.includes(card.id) ? loopOf(card) : null;
      if (loop) {
        const message = blockingLoopMessage(loop);
        announce?.(message);
        plan?.notify?.(message);
        return;
      }
      if (card)
        onSave(
          severalValue(SEVERAL, toggledValues(chosen, card.id, cardKey)) as string[] | undefined,
        );
      return;
    }
    const loop = card && card.id !== linkedId ? loopOf(card) : null;
    if (loop) {
      const message = blockingLoopMessage(loop);
      announce?.(message);
      plan?.notify?.(message);
      close();
      return;
    }
    if ((card?.id ?? undefined) !== linkedId) onSave(card?.id);
    close();
  };

  // Opened on the current link (set as it opens, not after), and the filter (or the list) takes the keys.
  const openList = () => {
    const at = options.findIndex((o) => held(o));
    setActive(at < 0 ? 0 : at);
    setListWidth(Math.max(LINK_LIST_MIN_PX, boxRef.current?.offsetWidth ?? 0));
    // Several: under the whole field, as the single field's list sits under its trigger.
    setAnchor(multiple ? boxRef.current : triggerRef.current);
    setOpen(true);
  };
  useEffect(() => {
    if (open) (filterRef.current ?? listRef.current)?.focus();
  }, [open]);
  // The cards that already wait on this one, each marked in the list: one walk per open list and items change, so a
  // closed field walks nothing.
  const waiting = useMemo(
    () => (open && blocksFor ? waitingOn(items, types, blocksFor) : null),
    [open, blocksFor, items, types],
  );

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => Math.min(options.length - 1, Math.max(0, a + step)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Tab') close(false);
  };

  const type = linked ? typeIn(types, linked.type) : undefined;
  const own = linked ? itemColourOf(linked, type) : undefined;
  const openLabel = linked ? `Open ${name}` : '';
  return (
    <div ref={boxRef} className="relative w-full">
      {multiple ? (
        <FieldChips
          ref={triggerRef}
          id={id}
          label={label}
          emptyText="None"
          disabled={disabled}
          open={open}
          listId={listId}
          onAdd={() => (open ? close() : openList())}
          onRemove={(key) => {
            onSave(
              severalValue(
                SEVERAL,
                chosen.filter((c) => c !== key),
              ) as string[] | undefined,
            );
            const gone = cardOf(key);
            announce?.(`Removed ${gone ? `#${gone.key}` : 'Missing card'}`);
          }}
          chips={chosen.map((cid) => {
            const card = cardOf(cid);
            const t = card ? typeIn(types, card.type) : undefined;
            const cardName = card ? `#${card.key} ${itemTitle(card)}` : 'Missing card';
            const body = (
              <>
                {t && card ? (
                  <span
                    className={`shrink-0 ${ACCENT_TEXT}`}
                    style={accentVars(itemColourOf(card, t) ?? t.color)}
                  >
                    <PlanTypeGlyph glyph={t.glyph} size={12} />
                  </span>
                ) : null}
                {card ? (
                  <>
                    {/* slate-600: slate-500 reads 4.3:1 on the chip's slate-100. */}
                    <span className="text-optical-line shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
                      #{card.key}
                    </span>
                    <span className="text-optical-line min-w-0 truncate">{itemTitle(card)}</span>
                  </>
                ) : (
                  <span className="text-optical-line italic text-slate-600 dark:text-slate-400">
                    Missing card
                  </span>
                )}
              </>
            );
            return {
              key: cid,
              name: cardName,
              // A chip opens its card, as the single field's open arrow does.
              content:
                card && onOpen ? (
                  <Tooltip label={`Open ${cardName}`}>
                    <button
                      type="button"
                      aria-label={`Open ${cardName}`}
                      onClick={() => onOpen(card.id)}
                      className="flex min-w-0 cursor-pointer items-center gap-1 rounded-full py-0.5 pl-1.5 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:text-brand-300"
                    >
                      {body}
                    </button>
                  </Tooltip>
                ) : (
                  <span className="flex min-w-0 items-center gap-1 pl-1.5">{body}</span>
                ),
            };
          })}
        />
      ) : (
        <div
          className={`flex min-h-[34px] w-full items-center rounded-md border bg-white transition dark:bg-slate-900 ${
            open
              ? 'border-brand-500 ring-2 ring-brand-500/20'
              : 'border-slate-200 dark:border-slate-700'
          } ${disabled ? 'opacity-60' : ''}`}
        >
          <Tooltip label={name}>
            <button
              ref={triggerRef}
              id={id}
              type="button"
              disabled={disabled}
              aria-label={`${label}: ${name}`}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              onClick={() => (open ? close() : openList())}
              onKeyDown={(e) => {
                if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                  e.preventDefault();
                  openList();
                }
              }}
              // 16px on a phone, as the card's selects are there (globals.css: iOS zooms a field under 16px on focus):
              // at 13px it read a size smaller than the Status and Priority beside it.
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pl-2 pr-1 text-left text-[13px] max-sm:text-[16px] outline-none enabled:cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {/* The linked card's own colour, when it has one, tints its type's glyph: no dot beside it. */}
              {type ? (
                <span
                  className={`shrink-0 ${ACCENT_TEXT}`}
                  style={accentVars(own ?? type.color)}
                  {...(own ? { role: 'img', 'aria-label': `${planColourName(own)} colour` } : {})}
                >
                  <PlanTypeGlyph glyph={type.glyph} size={14} />
                </span>
              ) : null}
              {linked ? (
                <>
                  <span className="shrink-0 rounded bg-slate-100 px-1 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-800">
                    #{linked.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                    {itemTitle(linked)}
                  </span>
                </>
              ) : (
                <span
                  className={`min-w-0 flex-1 truncate ${missing ? 'italic' : ''} text-slate-500 dark:text-slate-400`}
                >
                  {name}
                </span>
              )}
              <span aria-hidden className="shrink-0 text-slate-400">
                <ChevronDownIcon size={12} />
              </span>
            </button>
          </Tooltip>
          {linked && onOpen ? (
            <Tooltip label={openLabel}>
              <button
                type="button"
                aria-label={openLabel}
                onClick={() => onOpen(linked.id)}
                className="mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <ChevronRightIcon size={12} />
              </button>
            </Tooltip>
          ) : null}
        </div>
      )}
      {open && anchor ? (
        // Over the page, so the side column never clips it. Escape and a press outside close it (AnchoredPopover,
        // which takes Escape before the panel's own, so the card stays open).
        <AnchoredPopover
          anchor={anchor}
          name={`Choose ${label}`}
          width={listWidth}
          onClose={() => close(false)}
        >
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            {candidates.length > LINK_FILTER_FROM ? (
              <input
                ref={filterRef}
                type="text"
                value={query}
                placeholder="Find a card"
                aria-label={`Find a card for ${label}`}
                aria-controls={listId}
                aria-activedescendant={`${listId}-${active}`}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                className="w-full border-b border-slate-200 bg-transparent px-2 py-1.5 text-[13px] outline-none dark:border-slate-700"
              />
            ) : null}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={-1}
              aria-multiselectable={multiple || undefined}
              aria-activedescendant={`${listId}-${active}`}
              onKeyDown={onListKey}
              className="max-h-60 overflow-y-auto py-1 outline-none"
            >
              {options.map((card, i) => {
                const t = card ? typeIn(types, card.type) : undefined;
                const selected = held(card);
                const waits = !!card && !selected && !!waiting?.has(card.id);
                return (
                  <li
                    key={card?.id ?? 'none'}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={selected}
                    // The full number and title, whatever the clamp hides.
                    aria-label={
                      card
                        ? `#${card.key} ${itemTitle(card)}${waits ? ', waits on this card' : ''}`
                        : 'None'
                    }
                    aria-disabled={waits || undefined}
                    onPointerMove={() => setActive(i)}
                    onClick={() => pick(card)}
                    className={`flex cursor-pointer items-start gap-1.5 px-2 py-1.5 text-[13px] leading-snug max-sm:text-[16px] ${
                      i === active ? 'bg-slate-100 dark:bg-slate-800' : ''
                    } ${selected ? 'font-semibold' : ''}`}
                  >
                    {card && t ? (
                      <>
                        {/* Glyph and number sit level with the title's first line. */}
                        <span
                          className={`mt-[2px] shrink-0 ${ACCENT_TEXT}`}
                          style={accentVars(itemColourOf(card, t) ?? t.color)}
                        >
                          <PlanTypeGlyph glyph={t.glyph} size={14} />
                        </span>
                        <span className="mt-[2px] shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                          #{card.key}
                        </span>
                        {/* The title on up to two lines; a longer one ends in an ellipsis (the whole title in the
                          tooltip), and an unbroken string breaks rather than overflow. */}
                        <Tooltip label={itemTitle(card)}>
                          <span
                            className={`line-clamp-2 min-w-0 flex-1 [overflow-wrap:anywhere] ${waits ? 'text-slate-500 dark:text-slate-400' : ''}`}
                          >
                            {itemTitle(card)}
                          </span>
                        </Tooltip>
                        {waits ? (
                          <span className="mt-[2px] shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                            Waits on this card
                          </span>
                        ) : null}
                        {/* Several: each card linked is ticked. */}
                        {multiple && selected ? (
                          <span
                            aria-hidden
                            className="mt-[3px] shrink-0 text-brand-700 dark:text-brand-400"
                          >
                            <CheckIcon size={12} />
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">None</span>
                    )}
                  </li>
                );
              })}
              {options.length === (multiple ? 0 : 1) && query ? (
                <li role="presentation">
                  <NoMatches things="cards" query={query} />
                </li>
              ) : null}
            </ul>
          </div>
        </AnchoredPopover>
      ) : null}
    </div>
  );
}
