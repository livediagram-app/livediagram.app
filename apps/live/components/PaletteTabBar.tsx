import { useState } from 'react';

export type PaletteTab = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

// Replaces the old stack of Tools / Devices / Icons accordions with a
// single icon tab bar: clicking a tab expands its panel below, clicking
// the active tab again collapses it, and clicking another switches. One
// activeId makes the tabs mutually exclusive by construction, so the
// palette stays compact however many categories we add — a new category
// is just another entry in the `tabs` array the caller passes.
export function PaletteTabBar({
  tabs,
  defaultOpenId = null,
}: {
  tabs: PaletteTab[];
  // Tab to expand on first render. `null` (the default) opens the
  // palette with every panel collapsed; pass an id to have that
  // category open by default (Shapes, the most common entry point).
  defaultOpenId?: string | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(defaultOpenId);
  // Kept separate from activeId so the panel's content stays mounted
  // through the collapse animation: activeId drops to null immediately
  // on close (driving the 1fr -> 0fr grid transition), while displayedId
  // only changes when a *different* tab opens.
  const [displayedId, setDisplayedId] = useState<string | null>(defaultOpenId);
  const select = (id: string) => {
    if (activeId === id) {
      setActiveId(null);
      return;
    }
    setActiveId(id);
    setDisplayedId(id);
  };
  const displayed = tabs.find((t) => t.id === displayedId) ?? null;
  return (
    <div className="border-t border-slate-100 dark:border-slate-800">
      <div
        className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5 dark:border-slate-800"
        role="tablist"
        aria-label="Palette categories"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => select(tab.id)}
              className={
                isActive
                  ? 'flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 text-white shadow-sm transition'
                  : 'flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white'
              }
            >
              {tab.icon}
            </button>
          );
        })}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: activeId ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-3">{displayed?.content}</div>
        </div>
      </div>
    </div>
  );
}
