'use client';

// A link field's control in the card panel (docs/specs/026-plan/item-types.md "Card fields"): the built-in Parent
// and every Card field use this one control. One bordered field the full width of its row: the linked card's glyph
// in its type's colour (and its own colour dot), its number as a quiet tag and its full title, a chevron to choose,
// and an open arrow at the end, inside the same border, that opens the linked card. Choosing drops a list under
// the field (in place, so the panel's focus trap keeps it): a filter, None, then the candidate cards, each with its
// whole title (wrapping to three lines). Keys: Enter or Space opens it,
// the arrows move, Enter picks, Escape closes.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  itemColourOf,
  itemTitle,
  linkedCard,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@livediagram/items';
import { ChevronDownIcon, ChevronRightIcon, Tooltip, useEscape } from '@livediagram/ui';
import { PlanTypeGlyph } from './plan-type-glyph';
import { planColourName } from './ColourSwatches';
import { ACCENT_TEXT, accentVars } from './plan-palette';

// More candidates than this and the list opens with a filter.
export const LINK_FILTER_FROM = 8;

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
  onSave: (next: string | undefined) => void;
  onOpen: (itemId: string) => void;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const linkedId = typeof value === 'string' && value ? value : undefined;
  // The linked card, from the document's cards, else from the candidates (a host that passes only those).
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
    return [undefined, ...list] as (Item | undefined)[];
  }, [candidates, query]);

  const close = (refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (card: Item | undefined) => {
    if ((card?.id ?? undefined) !== linkedId) onSave(card?.id);
    close();
  };

  // Escape closes the list only, before the panel's own Escape (which would close the card).
  useEscape(() => close(), { enabled: open, capture: true, stopPropagation: true });

  // Opened on the current link (set as it opens, not after), and the filter (or the list) takes the keys.
  const openList = () => {
    const at = options.findIndex((o) => o?.id === linkedId);
    setActive(at < 0 ? 0 : at);
    setOpen(true);
  };
  useEffect(() => {
    if (open) (filterRef.current ?? listRef.current)?.focus();
  }, [open]);

  // A press outside the field closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

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
  const own = linked ? itemColourOf(linked) : undefined;
  const openLabel = linked ? `Open ${name}` : '';
  return (
    <div ref={boxRef} className="relative w-full">
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
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pl-2 pr-1 text-left text-[13px] outline-none enabled:cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-400"
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
                <span className="shrink-0 rounded bg-slate-100 px-1 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-800">
                  #{linked.key}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                  {itemTitle(linked)}
                </span>
              </>
            ) : (
              <span className={`min-w-0 flex-1 truncate ${missing ? 'italic' : ''} text-slate-400`}>
                {name}
              </span>
            )}
            <span aria-hidden className="shrink-0 text-slate-400">
              <ChevronDownIcon size={12} />
            </span>
          </button>
        </Tooltip>
        {linked ? (
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
      {open ? (
        // The field's width: the side column clips anything wider, and the list stays in place for the panel's focus
        // trap. Long titles wrap instead (below).
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
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
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKey}
            className="max-h-60 overflow-y-auto py-1 outline-none"
          >
            {options.map((card, i) => {
              const t = card ? typeIn(types, card.type) : undefined;
              const selected = (card?.id ?? undefined) === linkedId;
              return (
                <li
                  key={card?.id ?? 'none'}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={selected}
                  // The full number and title, whatever the clamp hides.
                  aria-label={card ? `#${card.key} ${itemTitle(card)}` : 'None'}
                  onPointerMove={() => setActive(i)}
                  onClick={() => pick(card)}
                  className={`flex cursor-pointer items-start gap-1.5 px-2 py-1.5 text-[13px] leading-snug ${
                    i === active ? 'bg-slate-100 dark:bg-slate-800' : ''
                  } ${selected ? 'font-semibold' : ''}`}
                >
                  {card && t ? (
                    <>
                      {/* Glyph and number sit level with the title's first line. */}
                      <span
                        className={`mt-[2px] shrink-0 ${ACCENT_TEXT}`}
                        style={accentVars(itemColourOf(card) ?? t.color)}
                      >
                        <PlanTypeGlyph glyph={t.glyph} size={14} />
                      </span>
                      <span className="mt-[2px] shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                        #{card.key}
                      </span>
                      {/* The whole title, wrapping to three lines; a longer one ends in an ellipsis, and an unbroken
                          string breaks rather than overflow. */}
                      <span className="line-clamp-3 min-w-0 flex-1 [overflow-wrap:anywhere]">
                        {itemTitle(card)}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">None</span>
                  )}
                </li>
              );
            })}
            {options.length === 1 && query ? (
              <li className="px-2 py-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                No cards match
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
