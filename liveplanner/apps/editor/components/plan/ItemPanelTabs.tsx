'use client';

// The item panel's tabs (docs/specs/026-plan/plan-board.md "Open an item" "Tabs"): the type's own tabs, then Activity
// on every card type, and on a phone the Details tab last, at the far right. The bar is a tablist: arrow keys move
// between the tabs, and it scrolls sideways when they do not fit. A card opens on the type's first tab.

// The Activity tab every card has, after the type's own (items.md "History" "Where it shows").
export const ACTIVITY_TAB = 'card-activity';
// The phone's last tab, holding what the Details panel holds on a wide screen.
export const DETAILS_TAB = 'details';

export type PanelTab = { id: string; label: string; fields: readonly string[] };

// The tabs the panel shows, in order. Activity holds no fields: the panel draws the card's history there.
export function panelTabs(tabs: readonly PanelTab[], details: PanelTab | null): PanelTab[] {
  const activity: PanelTab = { id: ACTIVITY_TAB, label: 'Activity', fields: [] };
  return details ? [...tabs, activity, details] : [...tabs, activity];
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
            tabIndex={on ? 0 : -1}
            onClick={() => onPick(t.id)}
            className={`${TAB_CLASS} ${on ? '' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
          >
            {t.label}
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
