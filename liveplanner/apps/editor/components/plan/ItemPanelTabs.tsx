'use client';

// The item panel's tabs (docs/specs/026-plan/plan-board.md "Open an item" "Tabs"): the type's own tabs, then Linked
// Cards on a card some Card field can link to (item-types.md "The Linked Cards tab"), then Activity on every card type,
// then Hidden on a card keeping values its type doesn't show (item-types.md "The Hidden tab"), and on a phone the
// Details tab last, at the far right. The bar is a tablist: arrow keys move
// between the tabs, and it scrolls sideways when they do not fit. A card opens on the type's first tab.

// The Activity tab every card has, after the type's own (items.md "History" "Where it shows").
export const ACTIVITY_TAB = 'card-activity';
// The phone's last tab, holding what the Details panel holds on a wide screen.
export const DETAILS_TAB = 'details';

// The generated Linked Cards tab, never saved into the type. A type's own tab ids start `t-` (newTabId), so it never
// clashes with one.
export const LINKED_TAB = 'card-linked';
export const LINKED_TAB_LABEL = 'Linked Cards';
// The generated Hidden tab, never saved into the type either.
export const HIDDEN_TAB = 'card-hidden';

// `count`: a number beside the label (the cards linked here, the hidden values); absent or 0, none. `unit`: what it
// counts, for its accessible name (cards when absent).
export type PanelTab = {
  id: string;
  label: string;
  fields: readonly string[];
  count?: number;
  unit?: 'value';
};

// The type's own tab named Linked Cards (ignoring case), which takes the Linked as sections in place of a second,
// generated tab of the same name; undefined when it has none.
export function namedLinkedTab<T extends PanelTab>(tabs: readonly T[]): T | undefined {
  const name = LINKED_TAB_LABEL.toLowerCase();
  return tabs.find((t) => t.label.trim().toLowerCase() === name);
}

// The tabs the panel shows, in order. Activity holds no fields: the panel draws the card's history there.
// `linked`: how many cards link here when some Card field can link to the card's type (null: none can, so no Linked
// Cards tab); the count rides on the type's own Linked Cards tab when it has one. `hidden`: how many hidden values the
// card keeps (0: no Hidden tab).
export function panelTabs(
  tabs: readonly PanelTab[],
  details: PanelTab | null,
  linked: number | null = null,
  hidden = 0,
): PanelTab[] {
  const activity: PanelTab = { id: ACTIVITY_TAB, label: 'Activity', fields: [] };
  let own: PanelTab[] = [...tabs];
  if (linked !== null) {
    const named = namedLinkedTab(tabs);
    own = named
      ? own.map((t) => (t === named ? { ...t, count: linked } : t))
      : [...own, { id: LINKED_TAB, label: LINKED_TAB_LABEL, fields: [], count: linked }];
  }
  const last: PanelTab[] = hidden
    ? [{ id: HIDDEN_TAB, label: 'Hidden', fields: [], count: hidden, unit: 'value' }]
    : [];
  return details ? [...own, activity, ...last, details] : [...own, activity, ...last];
}

// A tab's accessible name: its label, with its count when it shows one ("Linked Cards, 3 cards", "Hidden, 2 values").
function tabName(t: PanelTab): string | undefined {
  if (!t.count) return undefined;
  const unit = t.unit ?? 'card';
  return `${t.label}, ${t.count} ${t.count === 1 ? unit : `${unit}s`}`;
}

const TAB_CLASS =
  'relative shrink-0 cursor-pointer whitespace-nowrap px-1 pb-2 pt-1 text-[13px] font-medium transition aria-selected:text-brand-700 motion-reduce:transition-none pointer-coarse:pb-2.5 pointer-coarse:pt-1.5 dark:aria-selected:text-brand-300';

export function ItemPanelTabBar({
  itemId,
  tabs,
  current,
  onPick,
}: {
  itemId: string;
  tabs: readonly PanelTab[];
  current: string | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Item sections"
      className="mb-6 flex gap-5 overflow-x-auto overflow-y-hidden border-b border-slate-200 [scrollbar-width:none] dark:border-slate-700"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = tabs.findIndex((t) => t.id === current);
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!;
        onPick(next.id);
        document.getElementById(`item-${itemId}-tab-${next.id}`)?.focus();
      }}
    >
      {tabs.map((t) => {
        const on = t.id === current;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`item-${itemId}-tab-${t.id}`}
            data-panel-tab={t.id}
            aria-selected={on}
            aria-controls={`item-${itemId}-panel-${t.id}`}
            aria-label={tabName(t)}
            tabIndex={on ? 0 : -1}
            onClick={() => onPick(t.id)}
            className={`${TAB_CLASS} ${on ? '' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
          >
            {t.label}
            {t.count ? (
              <span
                aria-hidden
                className={`ml-1.5 inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-medium leading-[1.125rem] tabular-nums transition motion-reduce:transition-none ${on ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
              >
                {t.count}
              </span>
            ) : null}
            {on ? (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600 dark:bg-brand-400"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
