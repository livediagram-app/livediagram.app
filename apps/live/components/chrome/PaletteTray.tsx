'use client';

// The palette tray (docs/specs/007-editor/toolbar-layout.md "Layout details"): in the Toolbar layout, a message
// about the next press (a mode banner, the modifier hint) hangs from the strip's bottom edge instead of floating
// under it. One look for all of them: the strip's own surface, no top border so it joins the strip, rounded
// bottom corners, centred under the strip's card and never wider. Without a strip on screen there is no box,
// and the caller draws its usual top-centre pill instead.
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// The strip's card: the Palette in the Toolbar layout (ToolbarPalette's `data-tour-id="palette"` card).
const STRIP_CARD = '[data-toolbar-palette] [data-tour-id="palette"]';

export type StripBox = { left: number; width: number; bottom: number };

function measure(): StripBox | null {
  const card = document.querySelector<HTMLElement>(STRIP_CARD);
  // The strip hides (zen, the welcome flow) with `hidden` rather than unmounting.
  if (!card || card.closest('[data-toolbar-palette].hidden')) return null;
  const r = card.getBoundingClientRect();
  if (r.width <= 0) return null;
  return { left: r.left, width: r.width, bottom: r.bottom };
}

const same = (a: StripBox | null, b: StripBox | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.width === b.width && a.bottom === b.bottom);

// Where the Toolbar layout's strip card is on screen, kept current as it resizes or the window does; null
// while there is no strip (the floating palette, zen, read-only).
// `active` is whether a message is showing: each time one shows the strip is found afresh (it mounts late, or
// remounts, after read-only or layout flips), and the size watcher follows whichever card is on screen.
export function usePaletteStripBox(active = true): StripBox | null {
  const [box, setBox] = useState<StripBox | null>(() =>
    typeof document === 'undefined' ? null : measure(),
  );
  useEffect(() => {
    if (!active) return;
    let watched: HTMLElement | null = null;
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null;
    const update = () => {
      const card = document.querySelector<HTMLElement>(STRIP_CARD);
      if (card !== watched) {
        if (watched) observer?.unobserve(watched);
        if (card) observer?.observe(card);
        watched = card;
      }
      const next = measure();
      setBox((prev) => (same(prev, next) ? prev : next));
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return box;
}

// A small text action at the tray's end (Cancel, Done).
export function PaletteTrayAction({ label, onAction }: { label: string; onAction: () => void }) {
  return (
    <button
      type="button"
      onClick={onAction}
      className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {label}
    </button>
  );
}

export function PaletteTray({
  box,
  lead,
  children,
  end,
}: {
  box: StripBox;
  // The leading icon, or a modifier's key chip.
  lead: ReactNode;
  // The message.
  children: ReactNode;
  // Toggles and actions at the end of the row.
  end?: ReactNode;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="pointer-events-none fixed z-[var(--z-chrome)] flex justify-center"
      // Up a pixel, so the tray covers the strip's bottom border where they meet and the two read as one.
      style={{ left: box.left, width: box.width, top: box.bottom - 1 }}
    >
      <div
        // Floating UI: the canvas's capture-phase pointerdown leaves its presses alone (as TopCenterBanner).
        data-floating-panel=""
        data-palette-tray=""
        role="status"
        className="pointer-events-auto flex min-w-0 max-w-full animate-fade-in items-center gap-2 rounded-b-xl border border-t-0 border-slate-200 bg-white py-1 pl-3 pr-1 text-[13px] text-slate-700 shadow-[0_6px_10px_-6px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="flex shrink-0 items-center text-brand-600 dark:text-brand-300">
          {lead}
        </span>
        <span className="min-w-0 truncate">{children}</span>
        {end ? <span className="flex shrink-0 items-center gap-1">{end}</span> : null}
      </div>
    </div>,
    document.body,
  );
}
