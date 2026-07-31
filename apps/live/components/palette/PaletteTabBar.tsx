import { useEffect, useRef, useState } from 'react';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';

type PaletteTab = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  // Which band of the category dropdown this tab sits in — an index into
  // CATEGORY_BANDS below (spec/110). Nine equal-weight categories in one grid
  // is a wall; three named bands say what kind of thing each category is.
  //
  // Left unset for Favourites, which is not a kind of thing at all — it is
  // every category at once, so it sits full width above the first band with
  // no heading over it.
  group?: number;
  fullWidth?: boolean;
};

// The category dropdown's bands, in order. Tabs are listed in band order in
// the caller's `tabs` array, so the grid renders them under these headings
// without a sort here.
const CATEGORY_BANDS: Record<number, string> = {
  0: 'Common',
  1: 'Decorate',
  2: 'Dynamic',
};

// Renders the palette's category switcher as a single right-hand dropdown
// (Shapes / Tools / Devices / Icons) sitting in a header band, with an
// optional `leading` slot on the left for the canvas-tool picker. Picking a
// category swaps the panel below; one activeId keeps the categories
// mutually exclusive, so adding a category is just another entry in the
// `tabs` array the caller passes.
export function PaletteTabBar({
  tabs,
  leading,
  defaultOpenId,
  storageKey,
}: {
  tabs: PaletteTab[];
  // Control rendered at the left of the header band (the canvas-tool
  // dropdown). The category dropdown always sits on the right.
  leading?: React.ReactNode;
  // Category shown on first render. Defaults to the first tab so the panel
  // is never blank.
  defaultOpenId?: string;
  // When set, the chosen category is remembered in localStorage under this
  // key so it survives the palette being closed + reopened (the mobile /
  // minimal dock unmounts the popover) and page reloads. A stale id
  // (category removed) falls back to the default.
  storageKey?: string;
}) {
  const fallbackId = defaultOpenId ?? tabs[0]?.id ?? '';
  // Selected category — always set (the dropdown has no "collapsed" state).
  // Seeded from the remembered category when `storageKey` is set so
  // reopening the palette lands back where the user left off.
  const [activeId, setActiveId] = useState<string>(() => {
    if (!storageKey) return fallbackId;
    const saved = readLocalStorageSafe(storageKey);
    if (saved && tabs.some((t) => t.id === saved)) return saved; // guard stale id
    return fallbackId;
  });
  // Persist the choice so the next mount restores it.
  useEffect(() => {
    if (storageKey) writeLocalStorageSafe(storageKey, activeId);
  }, [storageKey, activeId]);
  const displayed = tabs.find((t) => t.id === activeId) ?? null;

  // Soft category-change animation. The panel's height is driven off the
  // measured content height and eased, so switching from a short
  // category (Tools) to a tall one (Icons) glides instead of snapping;
  // the content itself fades in (keyed below). `animate` gates the
  // transition on until after the first measured frame so the
  // default-open panel doesn't animate itself open on page load.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);
  // How much room is left below the body's top edge (spec/110). A category
  // like Components runs to ten rows, which on a short window ran off the
  // bottom of the screen with no way to reach the last few — the body took
  // its measured content height unconditionally. It is capped here instead,
  // and only then does it scroll: a category that fits still shows no
  // scrollbar and still animates its height.
  const [available, setAvailable] = useState<number | null>(null);
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

  // Re-measured on resize and after a drag (the panel is movable, so its top
  // edge changes without the window changing size), plus whenever the
  // category switches.
  useEffect(() => {
    const GUTTER = 12;
    // The floor is the bottom CHROME, not the viewport edge: the zoom dock
    // and the tab bar are the things a long category actually disappears
    // under. Measured rather than assumed a height, since the dock hides in
    // Zen mode and moves on mobile.
    const chromeTop = (selector: string): number => {
      const el = document.querySelector(selector);
      return el ? el.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
    };
    const measure = () => {
      const top = bodyRef.current?.getBoundingClientRect().top;
      if (top === undefined) return;
      const floor = Math.min(
        window.innerHeight,
        chromeTop('[data-zoom-controls]'),
        chromeTop('[data-editor-tabbar]'),
      );
      setAvailable(Math.max(120, floor - top - GUTTER));
    };
    measure();
    window.addEventListener('resize', measure);
    // Pointer-up rather than a move handler: the cap only has to be right
    // once the panel lands, and re-measuring every frame of a drag would
    // fight the drag for layout.
    window.addEventListener('pointerup', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointerup', measure);
    };
  }, [activeId]);

  return (
    // The host MovablePanel is given `flushTop` so this header band sits
    // flush under the panel title (floating) / popover top edge (dock), in
    // both layouts — no negative-margin hack needed here.
    <div>
      {/* Header band: the canvas-tool picker (left) and the category
          picker (right) on one row, flush to the top and sides, set off
          from the panel below by a bottom border. */}
      <div className="flex items-stretch justify-between border-b border-slate-200 dark:border-slate-700">
        {leading ?? <span />}
        <PaletteDropdown
          ariaLabel="Palette category"
          dataTourId="palette-category"
          value={activeId}
          align="right"
          variant="flush"
          // Grow to fit every category rather than capping at max-h +
          // scrolling — the list is short and fixed, so a scrollbar just
          // looked cramped.
          autoHeight
          // Tile grid (spec/108): nine equal-weight, icon-bearing categories
          // read faster as a grid than as a column you scan top to bottom,
          // and the bands (spec/110) group them by what they are for.
          grid
          groupLabels={CATEGORY_BANDS}
          onChange={setActiveId}
          options={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            icon: tab.icon,
            group: tab.group,
            fullWidth: tab.fullWidth,
          }))}
        />
      </div>
      <div
        ref={bodyRef}
        data-palette-body=""
        // Scrolls ONLY when it has to: `overflow-y-auto` shows no bar while
        // the content fits under the cap.
        className={`overflow-y-auto overflow-x-hidden${
          animate ? ' transition-[height] duration-200 ease-out' : ''
        }`}
        style={{
          height:
            height === null ? undefined : available === null ? height : Math.min(height, available),
        }}
      >
        <div ref={contentRef} className="px-2 pb-2.5 pt-2.5">
          <div key={displayed?.id ?? 'empty'} className="animate-fade-in">
            {displayed?.content}
          </div>
        </div>
      </div>
    </div>
  );
}
