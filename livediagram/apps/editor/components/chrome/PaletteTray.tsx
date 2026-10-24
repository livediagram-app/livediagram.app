'use client';

// The palette tray (docs/specs/007-editor/toolbar-layout.md "Layout details"): in the Toolbar layout, a message
// about the next press (a mode banner, the modifier hint) hangs from the strip's bottom edge instead of floating
// under it. One look for all of them: the strip's own surface, no top border so it joins the strip, rounded
// bottom corners, centred under the strip's card and never wider. Without a strip on screen there is no box,
// and the caller draws its usual top-centre pill instead.
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { EDITOR_VIEWPORT_ATTR } from '@/lib/editor-viewport';

// The strip's card: the Palette in the Toolbar layout (ToolbarPalette's `data-tour-id="palette"` card).
const STRIP_CARD = '[data-toolbar-palette] [data-tour-id="palette"]';

export type StripBox = { left: number; width: number; bottom: number; top: number };

function measure(selector: string): StripBox | null {
  const card = document.querySelector<HTMLElement>(selector);
  // The strip hides (zen, the welcome flow) with `hidden` rather than unmounting.
  if (!card || card.closest('[data-toolbar-palette].hidden')) return null;
  const r = card.getBoundingClientRect();
  if (r.width <= 0) return null;
  return { left: r.left, width: r.width, bottom: r.bottom, top: r.top };
}

const same = (a: StripBox | null, b: StripBox | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.left === b.left &&
    a.width === b.width &&
    a.bottom === b.bottom &&
    a.top === b.top);

// Where the Toolbar layout's strip card is on screen, kept current as it resizes or the window does; null
// while there is no strip (the floating palette, zen, read-only).
// `active` is whether a message is showing: each time one shows the strip is found afresh (it mounts late, or
// remounts, after read-only or layout flips), and the size watcher follows whichever card is on screen.
export function usePaletteStripBox(active = true): StripBox | null {
  return useToolbarBox(STRIP_CARD, active);
}

// Where a toolbar is on screen (the strip's card, Draw's dock), kept current as it or the window resizes; null while
// it is not on screen.
export function useToolbarBox(selector: string, active = true): StripBox | null {
  const [box, setBox] = useState<StripBox | null>(() =>
    typeof document === 'undefined' ? null : measure(selector),
  );
  useEffect(() => {
    if (!active) return;
    let watched: HTMLElement | null = null;
    let watchedParent: HTMLElement | null = null;
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null;
    const arrival =
      typeof MutationObserver !== 'undefined' ? new MutationObserver(() => update()) : null;
    const update = () => {
      const card = document.querySelector<HTMLElement>(selector);
      if (card !== watched) {
        if (watched) observer?.unobserve(watched);
        if (card) observer?.observe(card);
        watched = card;
      }
      // Its wrapper too: the strip's card is centred inside a whole-pixel box (SnapWidth's outer box, the card's
      // grandparent) that takes its new width a beat after the card's, so the card MOVES without resizing again;
      // that box's resize is the only signal of it (the category bar dropping its names left the tray off-centre).
      const parent = card?.parentElement?.parentElement ?? null;
      if (parent !== watchedParent) {
        if (watchedParent) observer?.unobserve(watchedParent);
        if (parent) observer?.observe(parent);
        watchedParent = parent;
      }
      const next = measure(selector);
      setBox((prev) => (same(prev, next) ? prev : next));
      // Not on screen yet (Draw's dock mounts a beat after an empty tab's pill asks for it): watch for it to
      // arrive, and stop watching once it has. Only a resize re-measured it before, so the pill kept its no-dock
      // place and sat on the dock's tools.
      if (card) arrival?.disconnect();
      else arrival?.observe(document.body, { childList: true, subtree: true });
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      arrival?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [active, selector]);
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

// Where the tray goes on the page: in the editor's own box, beside the strip, so it stacks with the editor's
// chrome. On the body it stood above the editor's whole stacking context, the header's popovers (who can see
// this, the account menu) included. A box with a transform (a split pane) holds its fixed children, so the
// tray's place is measured from that box's corner.
export function trayHost(): { node: HTMLElement; dx: number; dy: number } {
  const host = document
    .querySelector(STRIP_CARD)
    ?.closest<HTMLElement>(`[${EDITOR_VIEWPORT_ATTR}]`);
  if (!host) return { node: document.body, dx: 0, dy: 0 };
  if (getComputedStyle(host).transform === 'none') return { node: host, dx: 0, dy: 0 };
  const r = host.getBoundingClientRect();
  return { node: host, dx: r.left, dy: r.top };
}

export function PaletteTray({
  box,
  lead,
  children,
  end,
  standing = false,
}: {
  box: StripBox;
  // The leading icon, or a modifier's key chip.
  lead: ReactNode;
  // The message.
  children: ReactNode;
  // Toggles and actions at the end of the row.
  end?: ReactNode;
  // A standing message (an empty tab's Show Templates) rather than a mode's: it steps aside while a mode message
  // is on screen, as the two share the tray's slot (`[data-mode-message]` in globals.css).
  standing?: boolean;
}) {
  if (typeof document === 'undefined') return null;
  const host = trayHost();
  return createPortal(
    <div
      // Steps aside while the Explorer is open: its panel reaches under the strip (explorer-structure.md "Layout").
      className="pointer-events-none fixed z-[var(--z-chrome)] flex justify-center [body[data-explorer-open]_&]:hidden [body[data-strip-popover-open]_&]:hidden"
      // Up a pixel, so the tray covers the strip's bottom border where they meet and the two read as one.
      style={{ left: box.left - host.dx, width: box.width, top: box.bottom - 1 - host.dy }}
    >
      <div
        // Floating UI: the canvas's capture-phase pointerdown leaves its presses alone (as TopCenterBanner).
        data-floating-panel=""
        data-palette-tray=""
        {...(standing ? { 'data-yields-to-mode': '' } : { 'data-mode-message': '' })}
        role="status"
        className="pointer-events-auto flex min-w-0 max-w-full animate-fade-in items-center gap-2 rounded-b-xl border border-t-0 border-slate-200 bg-white py-1 pl-3 pr-1 text-[13px] text-slate-700 shadow-[0_6px_10px_-6px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="flex shrink-0 items-center text-brand-700 dark:text-brand-300">
          {lead}
        </span>
        {/* A phone-width tray wraps a long message to a second line rather than cutting off the name it gives
            ("Click to drop or drag to draw Squ…"). */}
        <span className="min-w-0 max-sm:line-clamp-2 sm:truncate">{children}</span>
        {end ? <span className="flex shrink-0 items-center gap-1">{end}</span> : null}
      </div>
    </div>,
    host.node,
  );
}
