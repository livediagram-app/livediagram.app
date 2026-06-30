export type ExplorerTab = {
  id: string;
  label: string;
};

// Horizontal segmented tab bar for the Explorer panel's sections
// (Recent / My Work / Teams). Replaces the three stacked accordions so
// only one section's list takes vertical space at a time — the whole
// reason this exists is to keep the floating panel compact. Sections
// that have nothing to show simply aren't passed in, so a solo guest
// sees a single "Recent" tab rather than dead chrome.
export function ExplorerTabBar({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: ExplorerTab[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  // The selection pill is one shared element positioned over the active
  // tab and translated when the selection moves, so switching tabs
  // slides the pill across rather than fading one out and another in.
  // A negative index (no match — the section list is collapsed) hides
  // it. Tabs are equal-width (flex-1) with no gap so the pill's width is
  // simply the track width divided by the tab count; the 0.25rem
  // subtracted accounts for the track's own p-0.5 padding on each side.
  const activeIndex = tabs.findIndex((t) => t.id === activeId);
  return (
    <div
      role="tablist"
      aria-label="Explorer sections"
      // -mx-0.5 lets the bar use a touch more of the card's width than
      // its padding would otherwise allow, so three labelled tabs fit
      // the narrow panel without truncating.
      className="relative -mx-0.5 flex items-stretch rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900/40"
    >
      {tabs.length > 0 ? (
        <span
          aria-hidden
          className={`pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 rounded-md bg-white shadow-sm transition-[transform,opacity] duration-200 ease-out dark:bg-slate-700 ${
            activeIndex < 0 ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            width: `calc((100% - 0.25rem) / ${tabs.length})`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          }}
        />
      ) : null}
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={`relative z-10 flex flex-1 items-center justify-center rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              active
                ? 'text-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
