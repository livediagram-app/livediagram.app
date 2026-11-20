'use client';

// The palette tray (docs/specs/007-editor/toolbar-layout.md "Layout details"): in the Toolbar layout, a message
// about the next press (a mode banner, the modifier hint) sits just under the strip instead of floating in the
// top-centre stack. One look for all of them: a card of the strip's own surface, a small gap below it (close
// enough to read as the strip's, apart so the two are not stuck together), centred under the strip's card and
// never wider, unless the strip is narrower than the tray's minimum. Without a strip on screen there is no box,
// and the caller draws its usual top-centre pill instead.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideSparkles } from '@liveworkspace/icons/lucide';
import { EDITOR_VIEWPORT_ATTR } from '../../lib/editor-viewport';
import { watchMove } from '../../lib/watch-move';
import { useViewportHeight } from '../../hooks/ui/useViewportHeight';

// The strip's card: the Palette in the Toolbar layout (ToolbarPalette's `data-tour-id="palette"` card).
const STRIP_CARD = '[data-toolbar-palette] [data-tour-id="palette"]';

/** The gap between the strip's bottom edge and the tray, in px. */
export const PALETTE_TRAY_GAP_PX = 6;

/** The narrowest the tray's slot gets, in px: under a strip narrower than this (a locked article's, holding only
 *  the selection mode and Search) the slot keeps this width, centred under the strip, so a message is not cut to
 *  its first letter ("C… Cancel"). Room for "Click to drop or drag to draw an arrow" and its Cancel. */
export const PALETTE_TRAY_MIN_WIDTH_PX = 360;

/** The tray's slot under `box`: the strip's width, or the minimum centred under it, kept 8 px inside the window.
 *  A phone too, where the strip's card sits beside the menu button and is narrower than the minimum (at most the
 *  window less 8 px each side): kept to the card's width, a tray's actions ran past its edge ("Keep It" at 390 px,
 *  "Show Templates" at 320 px) and its message wrapped to a second line. */
export function traySlot(
  box: StripBox,
  viewportWidth: number,
  minWidth: number = PALETTE_TRAY_MIN_WIDTH_PX,
): { left: number; width: number } {
  const width = Math.min(Math.max(box.width, minWidth), Math.max(0, viewportWidth - 16));
  if (width === box.width) return { left: box.left, width };
  const centred = box.left + box.width / 2 - width / 2;
  return { left: Math.max(8, Math.min(centred, viewportWidth - 8 - width)), width };
}

// A top-centre pill's room from the dock it stands clear of, px.
const DOCK_GAP = 10;

/** Where a top-centre pill goes without a strip: under a dock (livediagram's Draw dock) in the top half of the
 *  screen, over one in the bottom half, and with no dock, below the top chrome. */
export function pillPlace(
  dock: { top: number; bottom: number } | null,
  viewportHeight: number,
): { top: number } | { bottom: number } {
  if (!dock) return { top: 80 };
  return dock.top < viewportHeight / 2
    ? { top: dock.bottom + DOCK_GAP }
    : { bottom: viewportHeight - dock.top + DOCK_GAP };
}

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

// Where a toolbar is on screen (the strip's card), kept current as it or the window resizes; null while
// it is not on screen.
export function useToolbarBox(selector: string, active = true): StripBox | null {
  const [box, setBox] = useState<StripBox | null>(() =>
    typeof document === 'undefined' ? null : measure(selector),
  );
  useEffect(() => {
    if (!active) return;
    let watched: HTMLElement | null = null;
    let watchedParent: HTMLElement | null = null;
    // A move without a resize (the strip re-centring as the tab-name pill beside it changes width, a tab switch or
    // delete, the strip going crowded and back): watchMove, which costs nothing while the card is still.
    let stopMove: () => void = () => {};
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null;
    const arrival =
      typeof MutationObserver !== 'undefined' ? new MutationObserver(() => update()) : null;
    const update = () => {
      const card = document.querySelector<HTMLElement>(selector);
      if (card !== watched) {
        if (watched) observer?.unobserve(watched);
        if (card) observer?.observe(card);
        stopMove();
        stopMove = card ? watchMove(card, () => update()) : () => {};
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
      // Not on screen yet (a toolbar can mount a beat after something asks where it is): watch for it to
      // arrive, and stop watching once it has. Only a resize re-measured it before, so whatever stood clear of
      // it kept its no-toolbar place and sat on its tools.
      if (card) arrival?.disconnect();
      else arrival?.observe(document.body, { childList: true, subtree: true });
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      arrival?.disconnect();
      stopMove();
      window.removeEventListener('resize', update);
    };
  }, [active, selector]);
  return box;
}

// A small text action at the tray's end (Cancel, Done). `brand` marks the one a standing message offers first
// (Clear Example Content), in the brand's ink.
export function PaletteTrayAction({
  label,
  onAction,
  tone = 'quiet',
}: {
  label: string;
  onAction: () => void;
  tone?: 'quiet' | 'brand';
}) {
  return (
    <button
      type="button"
      onClick={onAction}
      className={`shrink-0 cursor-pointer whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${TRAY_ACTION_TONES[tone]}`}
    >
      {label}
    </button>
  );
}

const TRAY_ACTION_TONES = {
  quiet:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  brand:
    'text-brand-700 hover:bg-brand-50 hover:text-brand-800 dark:text-brand-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-200',
} as const;

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

// How many trays are on screen, so the top-centre stack can start below one (usePaletteTrayShown). A count rather
// than a flag: a mode banner's tray can mount while an empty tab's standing one is still up.
let traysShown = 0;
const trayListeners = new Set<() => void>();
const onTraysChange = (listener: () => void) => {
  trayListeners.add(listener);
  return () => {
    trayListeners.delete(listener);
  };
};
function countTray(step: 1 | -1) {
  traysShown += step;
  for (const listener of trayListeners) listener();
}

/** Whether any palette tray is on screen (a mode banner, the modifier hint, an empty tab's Show Templates, a
 *  template's example content): while one is, each editor's top-centre stack starts below the tray instead of the
 *  strip (`TopCenterStack` `below="tray"`), or the tray covers the Offline banner. */
export function usePaletteTrayShown(): boolean {
  return useSyncExternalStore(
    onTraysChange,
    () => traysShown > 0,
    () => false,
  );
}

export function PaletteTray({
  box,
  lead,
  children,
  end,
  standing = false,
  quietOnPhone = false,
  minWidth,
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
  // The message is for screen readers alone on a phone, where the tray's width holds only its actions: without a
  // place in the row it leaves no empty gap between the glyph and the first action.
  quietOnPhone?: boolean;
  // The narrowest the slot gets (traySlot), when the message and its actions need more than the default.
  minWidth?: number;
}) {
  useEffect(() => {
    countTray(1);
    return () => countTray(-1);
  }, []);
  if (typeof document === 'undefined') return null;
  const host = trayHost();
  const slot = traySlot(box, window.innerWidth, minWidth);
  // The card centres under the strip's card, not the slot: a slot kept inside the window (a phone, where the strip
  // sits off the window's centre beside the menu button) is not centred on the strip. Two growing spacers do it with
  // no measuring: the one on the strip's side starts twice the offset wide, so the card's centre lands on the
  // strip's, and a card too wide for that shrinks the spacer first, which keeps it inside the slot.
  const shift = box.left + box.width / 2 - (slot.left + slot.width / 2);
  return createPortal(
    <div
      // Steps aside while the Explorer is open: its panel reaches under the strip (explorer-structure.md "Layout").
      className="pointer-events-none fixed z-[var(--z-chrome)] flex [body[data-explorer-open]_&]:hidden [body[data-strip-popover-open]_&]:hidden"
      style={{
        left: slot.left - host.dx,
        width: slot.width,
        top: box.bottom + PALETTE_TRAY_GAP_PX - host.dy,
      }}
    >
      <span aria-hidden className="grow" style={{ flexBasis: Math.max(0, 2 * shift) }} />
      <PaletteTrayCard lead={lead} end={end} standing={standing} quietOnPhone={quietOnPhone}>
        {children}
      </PaletteTrayCard>
      <span aria-hidden className="grow" style={{ flexBasis: Math.max(0, -2 * shift) }} />
    </div>,
    host.node,
  );
}

// The tray's card: the strip's own surface, its lead glyph, the message and the actions at its end.
function PaletteTrayCard({
  lead,
  children,
  end,
  standing,
  quietOnPhone = false,
}: {
  lead: ReactNode;
  children: ReactNode;
  end?: ReactNode;
  standing: boolean;
  quietOnPhone?: boolean;
}) {
  return (
    <div
      // Floating UI: the canvas's capture-phase pointerdown leaves its presses alone (as TopCenterBanner).
      data-floating-panel=""
      data-palette-tray=""
      {...(standing ? { 'data-yields-to-mode': '' } : { 'data-mode-message': '' })}
      role="status"
      className="pointer-events-auto flex min-w-0 max-w-full shrink-0 animate-fade-in items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-3 pr-1 text-[13px] text-slate-700 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-slate-950/40"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="flex shrink-0 items-center text-brand-700 dark:text-brand-300">{lead}</span>
      {/* A phone-width tray wraps a long message to a second line rather than cutting off the name it gives
          ("Click to drop or drag to draw Squ…"). */}
      <span
        className={`min-w-0 sm:truncate ${quietOnPhone ? 'max-sm:sr-only' : 'max-sm:line-clamp-2'}`}
      >
        {children}
      </span>
      {end ? <span className="flex shrink-0 items-center gap-1">{end}</span> : null}
    </div>
  );
}

const SparklesGlyph = lucideGlyph(lucideSparkles, 15);

/** The narrowest the template example tray's slot gets, in px: its glyph, its whole sentence and both actions
 *  ("Clear Example Content", "Keep It"), which a narrow strip (a slide deck's, livediagram's, about 470 px) cut to
 *  "Example content shows how this ...". */
export const TEMPLATE_EXAMPLE_TRAY_MIN_WIDTH_PX = 520;

/**
 * A template's example content (liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md): while
 * the open tab still holds example values a template landed with, an Editor's palette tray says so, with Clear
 * Example Content and Keep It, as liveplanner's board says it of its example cards. A standing message: it steps
 * aside while a mode's message takes the slot. Without a strip on screen (the floating palette, Draw's dock) it is
 * the same card at the top centre. The editors mount it and own both actions (one undo step each).
 */
export function TemplateExampleTray({
  onClear,
  onKeep,
}: {
  onClear: () => void;
  onKeep: () => void;
}) {
  const strip = usePaletteStripBox();
  // Without a strip, Draw's dock: the pill stands just clear of it rather than over its tools.
  const dock = useToolbarBox('[data-whiteboard-dock]', !strip);
  const viewportHeight = useViewportHeight();
  const lead = <SparklesGlyph />;
  const end = (
    <>
      <PaletteTrayAction tone="brand" label="Clear Example Content" onAction={onClear} />
      <PaletteTrayAction label="Keep It" onAction={onKeep} />
    </>
  );
  // On a phone the tray's width (the window's, traySlot) holds only the two actions, so the sentence is for screen
  // readers there.
  const message = 'Example content shows how this works.';
  if (strip)
    return (
      <PaletteTray
        box={strip}
        standing
        quietOnPhone
        minWidth={TEMPLATE_EXAMPLE_TRAY_MIN_WIDTH_PX}
        lead={lead}
        end={end}
      >
        {message}
      </PaletteTray>
    );
  return (
    <div
      data-template-example-pill=""
      className="pointer-events-none fixed inset-x-0 z-[var(--z-chrome)] flex justify-center px-4 [body[data-explorer-open]_&]:hidden"
      style={pillPlace(dock, viewportHeight)}
    >
      <PaletteTrayCard lead={lead} end={end} standing quietOnPhone>
        {message}
      </PaletteTrayCard>
    </div>
  );
}
