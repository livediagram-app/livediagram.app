import { useEffect, useRef, useState } from 'react';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';
import { PaletteDropdown } from './PaletteDropdown';

export type PaletteTab = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
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
          value={activeId}
          align="right"
          variant="flush"
          onChange={setActiveId}
          options={tabs.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon }))}
        />
      </div>
      <div
        className={`overflow-hidden${animate ? ' transition-[height] duration-200 ease-out' : ''}`}
        style={{ height: height ?? undefined }}
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
