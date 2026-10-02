import { SegmentSlider } from '@/components/primitives/SegmentSlider';

export type ExplorerTab = {
  id: string;
  label: string;
};

// Horizontal segmented tab bar for the Explorer panel's sections
// (Recent / My documents / Teams). Replaces the three stacked accordions so
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
  // The selection pill slides between tabs (SegmentSlider). A negative
  // index (no match: the section list is collapsed) hides it.
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
      <SegmentSlider
        count={tabs.length}
        index={activeIndex}
        className="bg-white shadow-sm dark:bg-slate-700"
      />
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={`relative z-10 flex flex-1 items-center justify-center rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors ${
              active
                ? 'text-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span className="text-optical-line text-optical-caps truncate [--optical-tracking:0.025em]">
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
