'use client';

// Add Field's first step, Pick (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): a search at the
// top, then one list of field kinds, built-in and custom alike, in six groups, one open at a time. A kind whose
// built-in field the type lacks is tagged Ready to use; Comments and Votes (one to a type) add at once, every other
// kind opens Shape. A search filters the kinds and opens every group with a match. ↑ and ↓ move through the search and
// every result; Enter in the search picks the first match.
import { useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { ITEM_TYPE_CUSTOM_MAX, type CustomFieldKind, type ItemFieldId } from '@liveplanner/items';
import { CloseIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideChevronDown, lucideSearch } from '@liveworkspace/icons/lucide';
import {
  BUILT_INS_OF_KIND,
  CUSTOM_MAX_NOTE,
  KIND_DESCRIPTIONS,
  KIND_GROUPS,
  isOneToAType,
  kindMatches,
  readyBuiltIns,
  searchKey,
  type KindGroupId,
  type PickKind,
} from './add-field-kinds';
import { PICK_KIND_ICONS } from './CustomFieldKindParts';
import { BUILT_IN_FIELD_LABELS, PICK_KIND_LABELS } from './ItemTypeFieldForms';

const SearchIcon = lucideGlyph(lucideSearch, 15);
const Chevron = lucideGlyph(lucideChevronDown, 14);

const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900';

// A kind as the list shows it: hidden (a one-to-a-type field the type has), open to press, or dimmed (the type
// holds the most custom fields and the kind has no built-in field left to add).
type KindState = 'hidden' | 'open' | 'dimmed';

export function kindState(
  kind: PickKind,
  missing: readonly ItemFieldId[],
  canAddCustom: boolean,
): KindState {
  const ready = readyBuiltIns(kind, missing).length > 0;
  if (isOneToAType(kind)) return ready ? 'open' : 'hidden';
  return ready || canAddCustom ? 'open' : 'dimmed';
}

export function AddFieldPicker({
  query,
  onQuery,
  openGroup,
  onOpenGroup,
  missing,
  canAddCustom,
  onAddBuiltIn,
  onPick,
  onCancel,
  focusKind,
}: {
  query: string;
  onQuery: (query: string) => void;
  // The accordion's open group (null: all closed); a search sets it aside without changing it.
  openGroup: KindGroupId | null;
  onOpenGroup: (group: KindGroupId | null) => void;
  // The built-in fields the type lacks.
  missing: readonly ItemFieldId[];
  canAddCustom: boolean;
  onAddBuiltIn: (id: ItemFieldId) => void;
  onPick: (kind: CustomFieldKind) => void;
  onCancel: () => void;
  // The kind to focus on arriving (back from Shape).
  focusKind?: CustomFieldKind | undefined;
}) {
  const root = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const key = searchKey(query);
  const searching = key.length > 0;
  const groups = KIND_GROUPS.map((g) => ({
    ...g,
    shown: g.kinds.filter(
      (k) =>
        kindState(k, missing, canAddCustom) !== 'hidden' &&
        kindMatches(
          k,
          PICK_KIND_LABELS[k],
          key,
          (BUILT_INS_OF_KIND[k] ?? []).map((id) => BUILT_IN_FIELD_LABELS[id]),
        ),
    ),
  }));
  const kindCount = groups.reduce((n, g) => n + g.shown.length, 0);
  const nothing = searching && kindCount === 0;

  // Back from Shape: the kind that was picked takes focus (its group is open, or the search shows it).
  useLayoutEffect(() => {
    if (!focusKind) return;
    root.current?.querySelector<HTMLElement>(`[data-kind="${focusKind}"]`)?.focus();
    // Arriving only.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const nav = [...(root.current?.querySelectorAll<HTMLElement>('[data-nav]') ?? [])];
    const at = nav.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const inSearch = document.activeElement === searchRef.current;
    let to = -1;
    if (e.key === 'ArrowDown') to = Math.min(nav.length - 1, at + 1);
    else if (e.key === 'ArrowUp') to = Math.max(0, at - 1);
    else if (e.key === 'Home' && !inSearch) to = 1;
    else if (e.key === 'End' && !inSearch) to = nav.length - 1;
    else if (e.key === 'Enter' && inSearch) {
      e.preventDefault();
      if (searching) root.current?.querySelector<HTMLElement>('[data-pick]')?.click();
      return;
    }
    if (to < 0 || !nav[to]) return;
    e.preventDefault();
    nav[to]!.focus();
  };

  const press = (kind: PickKind) => {
    if (isOneToAType(kind)) {
      const id = readyBuiltIns(kind, missing)[0];
      if (id) onAddBuiltIn(id);
      return;
    }
    onPick(kind);
  };

  return (
    <div ref={root} onKeyDown={onKeyDown} className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-white px-3 pb-2 pt-3 dark:bg-slate-900">
        <label htmlFor={`${ids}-search`} className="sr-only">
          Search fields
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800">
          <span aria-hidden className="text-slate-400">
            <SearchIcon />
          </span>
          <input
            ref={searchRef}
            id={`${ids}-search`}
            type="search"
            data-nav=""
            autoComplete="off"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search fields, like money or date"
            aria-describedby={`${ids}-count`}
            className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 pointer-coarse:min-h-11 dark:text-slate-100 dark:placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onCancel}
          className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 motion-reduce:transition-none pointer-coarse:size-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${FOCUS_RING}`}
        >
          <CloseIcon size={12} />
        </button>
      </div>
      <p id={`${ids}-count`} aria-live="polite" className="sr-only">
        {searching ? `${kindCount} ${kindCount === 1 ? 'field matches' : 'fields match'}` : ''}
      </p>
      <div className="flex flex-col gap-1 px-3 pb-3 motion-safe:animate-card-rise">
        {canAddCustom ? null : (
          <p
            role="note"
            className="mb-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-[12px] leading-snug text-slate-600 dark:border-slate-600 dark:text-slate-300"
          >
            {CUSTOM_MAX_NOTE(ITEM_TYPE_CUSTOM_MAX)}
          </p>
        )}
        {nothing ? (
          <div role="status" className="px-2 py-6 text-center">
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
              No matches for “{query.trim()}”
            </p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              Try a word like money, date or parent.
            </p>
          </div>
        ) : null}
        {groups.map((g) => {
          if (g.shown.length === 0) return null;
          const open = searching || openGroup === g.id;
          const listId = `${ids}-${g.id}`;
          return (
            <div
              key={g.id}
              className={`rounded-xl border transition-colors motion-reduce:transition-none ${
                open
                  ? 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40'
                  : 'border-transparent'
              }`}
            >
              <h4>
                <button
                  type="button"
                  data-nav=""
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-disabled={searching || undefined}
                  onClick={() => {
                    if (!searching) onOpenGroup(openGroup === g.id ? null : g.id);
                  }}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[13px] font-semibold text-slate-800 transition motion-reduce:transition-none pointer-coarse:min-h-11 dark:text-slate-100 ${
                    searching
                      ? 'cursor-default'
                      : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
                  } ${FOCUS_RING}`}
                >
                  <span className="flex-1">{g.label}</span>
                  <span className="rounded-full bg-slate-200/70 px-1.5 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {g.shown.length}
                  </span>
                  <span
                    aria-hidden
                    className={`text-slate-400 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`}
                  >
                    <Chevron />
                  </span>
                </button>
              </h4>
              {open ? (
                <ul
                  id={listId}
                  className="flex flex-col gap-0.5 px-1 pb-1 motion-safe:animate-card-rise"
                >
                  {g.shown.map((k) => (
                    <li key={k}>
                      <KindRow
                        kind={k}
                        descId={`${ids}-${k}-desc`}
                        ready={!isOneToAType(k) && readyBuiltIns(k, missing).length > 0}
                        dimmed={kindState(k, missing, canAddCustom) === 'dimmed'}
                        onPress={press}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One kind: its icon on a soft tile, its name (tagged Ready to use when the type lacks a built-in field of it), and
// what it holds in a line.
function KindRow({
  kind,
  descId,
  ready,
  dimmed,
  onPress,
}: {
  kind: PickKind;
  descId: string;
  ready: boolean;
  dimmed: boolean;
  onPress: (kind: PickKind) => void;
}) {
  return (
    <button
      type="button"
      data-nav=""
      {...(dimmed ? { 'aria-disabled': true } : { 'data-pick': '' })}
      data-kind={kind}
      aria-label={PICK_KIND_LABELS[kind]}
      aria-describedby={descId}
      onClick={() => {
        if (!dimmed) onPress(kind);
      }}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition motion-reduce:transition-none pointer-coarse:min-h-11 ${
        dimmed
          ? 'cursor-not-allowed opacity-45'
          : 'cursor-pointer hover:bg-white focus-visible:bg-white dark:hover:bg-slate-900 dark:focus-visible:bg-slate-900'
      } ${FOCUS_RING}`}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 transition group-hover:bg-brand-50 group-hover:text-brand-700 group-hover:ring-brand-200 motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:group-hover:bg-brand-500/15 dark:group-hover:text-brand-200 dark:group-hover:ring-brand-500/40"
      >
        {PICK_KIND_ICONS[kind]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-slate-900 dark:text-slate-50">
            {PICK_KIND_LABELS[kind]}
          </span>
          {ready ? (
            <span className="rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30">
              Ready to use
            </span>
          ) : null}
        </span>
        <span id={descId} className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
          {KIND_DESCRIPTIONS[kind]}
        </span>
      </span>
    </button>
  );
}
