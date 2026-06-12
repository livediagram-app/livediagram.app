import { useEffect, useRef, useState } from 'react';

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
  // Committed tab (click to pin). Hovering a tab on desktop previews
  // its panel without committing, so the user can peek into a category
  // for discovery and revert by moving the pointer away — no click.
  const [activeId, setActiveId] = useState<string | null>(defaultOpenId);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Desktop hover wins over the committed tab; on touch hoverId stays
  // null (the pointer handlers below ignore non-mouse pointers, since a
  // tap would otherwise flash a preview before the click registers).
  const shownId = hoverId ?? activeId;
  // Kept so the panel's content stays mounted through the collapse
  // animation: shownId drops to null the instant the pointer leaves an
  // unpinned preview (driving the height -> 0 transition), while
  // displayedId holds the last shown tab so its content doesn't blank
  // out mid-animation.
  const [displayedId, setDisplayedId] = useState<string | null>(defaultOpenId);
  useEffect(() => {
    if (shownId) setDisplayedId(shownId);
  }, [shownId]);
  const select = (id: string) => setActiveId((prev) => (prev === id ? null : id));
  const displayed = tabs.find((t) => t.id === (shownId ?? displayedId)) ?? null;

  // Soft category-change animation. The panel's height is driven off the
  // measured content height and eased, so switching from a short
  // category (Tools) to a tall one (Icons) glides instead of snapping;
  // the content itself fades in (keyed below). `animate` gates the
  // transition on until after the first measured frame so the
  // default-open panel doesn't animate itself open on page load.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Desktop-only hover preview. onPointerOver bubbles, so we read the
  // tab under the pointer from the event target and only update when
  // it's actually a tab button — moving the pointer DOWN into the
  // previewed panel finds no tab and leaves the preview untouched, so
  // the previewed content stays usable. Leaving the whole component
  // (tab row + panel) reverts to the committed tab.
  const previewOver = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const id = (e.target as Element | null)
      ?.closest?.('[data-tab-id]')
      ?.getAttribute('data-tab-id');
    if (id) setHoverId(id);
  };
  const previewLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    setHoverId(null);
  };

  return (
    <div
      className="border-t border-slate-100 dark:border-slate-800"
      onPointerOver={previewOver}
      onPointerLeave={previewLeave}
    >
      <div className="border-b border-slate-100 px-2 py-1.5 dark:border-slate-800">
        {/* Joined segmented control: the categories are mutually exclusive
            (one panel open at a time), so the tabs sit flush in one
            bordered group with dividers rather than separate buttons. */}
        <div
          className="flex items-stretch divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700"
          role="tablist"
          aria-label="Palette categories"
        >
          {tabs.map((tab) => {
            // Highlight follows the *shown* tab so the lit icon always
            // matches the panel below, including during a hover preview.
            const isShown = tab.id === shownId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-tab-id={tab.id}
                aria-selected={tab.id === activeId}
                aria-label={tab.label}
                onClick={() => select(tab.id)}
                className={
                  isShown
                    ? 'flex h-9 flex-1 items-center justify-center bg-brand-500 text-white transition'
                    : 'flex h-9 flex-1 items-center justify-center text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white'
                }
              >
                {tab.icon}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className={`overflow-hidden${animate ? ' transition-[height] duration-200 ease-out' : ''}`}
        style={{ height: shownId ? (height ?? undefined) : 0 }}
      >
        <div ref={contentRef} className="px-3 pb-3 pt-3">
          <div key={displayed?.id ?? 'empty'} className="animate-fade-in">
            {displayed?.content}
          </div>
        </div>
      </div>
    </div>
  );
}
