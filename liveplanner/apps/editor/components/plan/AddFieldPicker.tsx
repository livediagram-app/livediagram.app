'use client';

// Add Field's first step, Pick (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field): a search at the
// top, the built-in fields the type lacks as Ready-made tiles (one press adds one), and the custom field kinds as
// "Your own field", in four groups, one open at a time. A search filters both and opens every group with a match.
// ↑ and ↓ move through the search and every result; Enter in the search picks the first match.
import { useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { ITEM_TYPE_CUSTOM_MAX, type CustomFieldKind, type ItemFieldId } from '@liveplanner/items';
import { CloseIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideChevronDown, lucideSearch } from '@liveworkspace/icons/lucide';
import {
  CUSTOM_MAX_NOTE,
  KIND_DESCRIPTIONS,
  KIND_GROUPS,
  kindMatches,
  matchingBuiltIns,
  searchKey,
  type KindGroupId,
} from './add-field-kinds';
import { CUSTOM_KIND_ICONS, fieldIconOf } from './CustomFieldKindParts';
import { BUILT_IN_FIELD_LABELS, CUSTOM_KIND_LABELS } from './ItemTypeFieldForms';

const SearchIcon = lucideGlyph(lucideSearch, 15);
const Chevron = lucideGlyph(lucideChevronDown, 14);

const SECTION_HEADING =
  'px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900';

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
  const builtIns = matchingBuiltIns(missing, (id) => BUILT_IN_FIELD_LABELS[id], key);
  const groups = KIND_GROUPS.map((g) => ({
    ...g,
    shown: g.kinds.filter((k) => kindMatches(k, CUSTOM_KIND_LABELS[k], key)),
  }));
  const kindCount = canAddCustom ? groups.reduce((n, g) => n + g.shown.length, 0) : 0;
  const nothing = searching && builtIns.length === 0 && kindCount === 0;

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
        {searching
          ? `${builtIns.length + kindCount} ${builtIns.length + kindCount === 1 ? 'field matches' : 'fields match'}`
          : ''}
      </p>
      <div className="flex flex-col gap-3 px-3 pb-3 motion-safe:animate-card-rise">
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
        {builtIns.length > 0 ? (
          <section aria-labelledby={`${ids}-ready`}>
            <h3 id={`${ids}-ready`} className={SECTION_HEADING}>
              Ready-made
            </h3>
            <div
              data-ready-made=""
              className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1.5"
            >
              {builtIns.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-nav=""
                  data-pick=""
                  onClick={() => onAddBuiltIn(id)}
                  className={`flex min-h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-[12px] font-medium text-slate-800 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 motion-reduce:transition-none pointer-coarse:min-h-11 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10 dark:hover:text-brand-100 ${FOCUS_RING}`}
                >
                  <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
                    {fieldIconOf(id, undefined).node}
                  </span>
                  <span className="truncate">{BUILT_IN_FIELD_LABELS[id]}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {!nothing && (canAddCustom ? kindCount > 0 || !searching : !searching) ? (
          <section aria-labelledby={`${ids}-own`}>
            <h3 id={`${ids}-own`} className={SECTION_HEADING}>
              Your own field
            </h3>
            {canAddCustom ? (
              <div className="flex flex-col gap-1">
                {groups.map((g) => {
                  if (searching && g.shown.length === 0) return null;
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
                            {searching ? g.shown.length : g.kinds.length}
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
                              <KindRow kind={k} descId={`${ids}-${k}-desc`} onPick={onPick} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-[12px] leading-snug text-slate-600 dark:border-slate-600 dark:text-slate-300">
                {CUSTOM_MAX_NOTE(ITEM_TYPE_CUSTOM_MAX)}
              </p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

// One kind: its icon on a soft tile, its name, and what it holds in a line.
function KindRow({
  kind,
  descId,
  onPick,
}: {
  kind: CustomFieldKind;
  descId: string;
  onPick: (kind: CustomFieldKind) => void;
}) {
  return (
    <button
      type="button"
      data-nav=""
      data-pick=""
      data-kind={kind}
      aria-label={CUSTOM_KIND_LABELS[kind]}
      aria-describedby={descId}
      onClick={() => onPick(kind)}
      className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white focus-visible:bg-white motion-reduce:transition-none pointer-coarse:min-h-11 dark:hover:bg-slate-900 dark:focus-visible:bg-slate-900 ${FOCUS_RING}`}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 transition group-hover:bg-brand-50 group-hover:text-brand-700 group-hover:ring-brand-200 motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:group-hover:bg-brand-500/15 dark:group-hover:text-brand-200 dark:group-hover:ring-brand-500/40"
      >
        {CUSTOM_KIND_ICONS[kind]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">
          {CUSTOM_KIND_LABELS[kind]}
        </span>
        <span id={descId} className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
          {KIND_DESCRIPTIONS[kind]}
        </span>
      </span>
    </button>
  );
}
