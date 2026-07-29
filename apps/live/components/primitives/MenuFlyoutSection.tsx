'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useReposition } from '@/hooks/canvas/useReposition';
import { VIEWPORT_EDGE_MARGIN } from '@/lib/clamp-to-viewport';

// A menu category that opens its contents in a **side flyout** instead of
// expanding inline (spec/09). The trigger row looks exactly like a
// MenuAccordionSection header (icon · uppercase title · chevron), but clicking
// it floats a panel to the SIDE — to the right of the menu if there's room,
// otherwise to the left — so several categories can be grouped under one row
// without making the menu any taller. Reusable across any context menu
// (ContextMenu / PortalMenu); its children can be anything, including ordinary
// MenuAccordionSections that keep working as normal inside the flyout.
//
// The flyout panel is portalled to <body> so it escapes the host menu's
// `overflow-hidden`, and marks itself `data-menu-flyout` so the host's
// outside-click guard treats clicks inside it as inside the menu (ContextMenu
// and PortalMenu both honour that marker) — the flyout runs its own
// outside-click to close only itself when you click another row or off-menu.
// Consecutive frames agreeing on the position before the tracker stops.
const SETTLE_FRAMES = 3;

export function MenuFlyoutSection({
  title,
  icon,
  children,
  // Match MenuAccordionSection: no top hairline where the parent bands rows
  // into groups with its own separators.
  flush = false,
  // Fired each time the flyout opens — e.g. so the caller can auto-expand the
  // first sub-category inside it.
  onOpen,
  // Controlled mode (the context-menu scaffold's flyoutProps): the open
  // state lives in the caller so it survives this row remounting when the
  // menu retargets to another element. Omit both to fall back to local
  // state (open + onToggle travel together).
  open: controlledOpen,
  onToggle,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  flush?: boolean;
  onOpen?: () => void;
  open?: boolean;
  onToggle?: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [localOpen, setLocalOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : localOpen;
  // On a phone the flyout COVERS its parent menu instead of sitting beside it
  // (spec/98): there is no room to the side, so the side layout degenerated
  // into an unlabelled panel dropped on top of the menu with no way back.
  // `width` is only set in that mode, where the panel matches the menu it
  // replaces; the desktop panel keeps its fixed w-56.
  const isMobile = useIsMobileViewport();
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width?: number;
    minHeight?: number;
  } | null>(null);
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlled) {
        if (next !== open) onToggle?.();
      } else {
        setLocalOpen(next);
      }
    },
    [controlled, open, onToggle],
  );

  // Place the flyout beside the trigger row: to the right when it fits, else
  // to the left. Top-aligned with the row; when the panel would overflow the
  // bottom it BOTTOM-ALIGNS to the row (opening upward) before falling back
  // to a plain clamp. Runs before paint (useReposition) and again on scroll /
  // resize / content grow.
  //
  // Returns whether the position it computed matches what's already on
  // screen, so the tracker below can stop once things have settled.
  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return true;
    const tr = trigger.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const m = VIEWPORT_EDGE_MARGIN;
    const gap = 2;
    // Mobile: sit exactly over the host menu, matching its box, so the child
    // reads as having replaced the parent rather than as a stray panel. Falls
    // through to the side layout if the trigger somehow has no menu ancestor.
    if (isMobile) {
      const host = trigger.closest('[role="menu"]')?.getBoundingClientRect();
      if (host) {
        const width = Math.round(host.width);
        const left = Math.round(
          Math.max(m, Math.min(host.left, Math.max(m, window.innerWidth - width - m))),
        );
        // Prefer the menu's own top. A taller child hangs off the bottom, so
        // pull it up just enough to fit rather than letting it run off-screen.
        const maxTop = Math.max(m, window.innerHeight - pr.height - m);
        const top = Math.round(Math.max(m, Math.min(host.top, maxTop)));
        // Cover the parent COMPLETELY. A child shorter than its parent left
        // the parent's remaining rows poking out below it, which reads as a
        // stray panel dropped on the menu rather than as having drilled into
        // it — and those rows are still tappable, so the two menus fight.
        // Bounded by the viewport so a tall parent can't push it off-screen.
        const minHeight = Math.round(Math.min(host.height, window.innerHeight - top - m));
        let settledMobile = true;
        setPos((prev) => {
          if (
            prev &&
            prev.left === left &&
            prev.top === top &&
            prev.width === width &&
            prev.minHeight === minHeight
          )
            return prev;
          settledMobile = false;
          return { left, top, width, minHeight };
        });
        return settledMobile;
      }
    }
    const fitsRight = tr.right + gap + pr.width + m <= window.innerWidth;
    const rawLeft = fitsRight ? tr.right + gap : tr.left - gap - pr.width;
    // Prefer hanging DOWN from the row. If that overflows the bottom, hang UP
    // from it instead (the flip the trigger's own row anchors), and only if
    // neither fits fall back to pinning at the top margin. Flipping keeps the
    // panel attached to the row it belongs to; the old clamp-only version slid
    // it up the screen until it no longer lined up with anything.
    const rawTop =
      tr.top + pr.height + m <= window.innerHeight ? tr.top : Math.max(m, tr.bottom - pr.height);
    // ROUND to whole pixels. getBoundingClientRect returns sub-pixel floats,
    // and this used to be stored raw: a trigger sitting on a fractional
    // boundary produced a hair-different `top` on every measurement, so the
    // equality bail-out below never engaged and the panel re-rendered (and
    // visibly jittered) on every frame of the tracker. Whole pixels give the
    // comparison something stable to latch onto.
    const left = Math.round(Math.max(m, Math.min(rawLeft, window.innerWidth - pr.width - m)));
    const top = Math.round(Math.max(m, Math.min(rawTop, window.innerHeight - pr.height - m)));
    let settled = true;
    setPos((prev) => {
      if (prev && prev.left === left && prev.top === top) return prev;
      settled = false;
      return { left, top };
    });
    return settled;
  }, [isMobile]);

  const [trackNonce, setTrackNonce] = useState(0);
  const retrack = useCallback(() => setTrackNonce((n) => n + 1), []);

  useReposition(() => {
    if (!open) return;
    measure();
    retrack();
  }, [open, measure, retrack]);

  // Re-clamp when a section inside the flyout expands and grows the panel.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const ro = new ResizeObserver(() => {
      measure();
      // A content change can also move the host menu (and so the trigger),
      // so wake the tracker rather than relying on this one reading.
      retrack();
    });
    ro.observe(panel);
    return () => ro.disconnect();
  }, [open, measure, retrack]);

  // Track the TRIGGER while open. The host menu can grow or shrink under
  // us with no scroll / resize event and no panel size change — expanding
  // or collapsing one of its inline accordions re-lays the rows out, and
  // a bottom-clamped menu then shifts wholesale — which left the flyout
  // floating where its row USED to be. No observer fires for "an unrelated
  // element moved", so poll the trigger's rect.
  //
  // The poll SETTLES: it stops after a few consecutive frames that agree on
  // the position, and re-arms whenever something that could move the trigger
  // happens (the panel resizing, a scroll, a viewport resize). It used to run
  // unconditionally for the whole open lifetime, forcing two synchronous
  // layout reads every frame forever — which is both wasteful and, when a
  // measurement was unstable, an endless reposition the popover never
  // recovered from.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    // Consecutive agreeing frames before we call it settled. More than one so
    // a mid-animation measurement can't end the poll early.
    let stable = 0;
    const track = () => {
      if (measure()) stable += 1;
      else stable = 0;
      if (stable >= SETTLE_FRAMES) return;
      raf = window.requestAnimationFrame(track);
    };
    raf = window.requestAnimationFrame(track);
    return () => window.cancelAnimationFrame(raf);
  }, [open, measure, trackNonce]);

  // Close the flyout on a click that's neither on its trigger nor inside its
  // panel — i.e. another menu row, or off the menu entirely. The host menu
  // keeps itself open for clicks inside the panel via the data-menu-flyout
  // marker, so the two guards don't fight.
  useEffect(() => {
    if (!open) return;
    // pointerdown, not mousedown: a touch only emits a compatibility mousedown
    // when the gesture wasn't preventDefault'd, so on a phone this dismisser
    // could simply never fire — the same flaw the tab menu's own dismisser had.
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      // Clicking back into a text-edit session (the editor or its floating
      // toolbar) keeps the flyout open — the context menu stays alongside
      // the editor while a label is being edited (spec/09), and moving the
      // caret shouldn't collapse the open category.
      if (t instanceof Element && t.closest('[data-rich-text-session]')) return;
      // Clicking a canvas ELEMENT retargets the host menu to it rather than
      // dismissing it (spec/09 menu-follows-selection), so the open flyout
      // must ride along too — collapsing it on every element switch broke
      // the style-several-elements-in-a-row flow. Empty-canvas clicks still
      // close the whole menu (the canvas handler), which unmounts this.
      if (t instanceof Element && t.closest('[data-element-id]')) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, setOpen]);

  return (
    <div
      className={flush ? '' : 'border-t border-slate-100 first:border-t-0 dark:border-slate-800'}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          const next = !open;
          setPos(null);
          setOpen(next);
          if (next) onOpen?.();
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition ${
          open
            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300'
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
          {title}
        </span>
        {/* Ellipsis — signals the row opens further sub-options (in a side
            flyout), distinct from an accordion's chevron that expands inline. */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="4" cy="8" r="1.15" />
          <circle cx="8" cy="8" r="1.15" />
          <circle cx="12" cy="8" r="1.15" />
        </svg>
      </button>
      {open ? (
        <Portal>
          <div
            ref={panelRef}
            role="menu"
            data-menu-flyout=""
            onPointerDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            // z-popover, not z-overlay: this panel opens FROM a menu that is itself
            // z-modal, so at z-overlay it lost the stacking contest with its own
            // host. On a wide screen that never showed, because the panel fits
            // beside the menu and never overlaps it. On a narrow one there is no
            // room to the side, the clamp puts it directly over the menu, and it
            // rendered behind — tapping Collaborate on a phone appeared to do
            // nothing at all. Same reason the token exists for menus opened inside
            // a dialog.
            className="fixed z-[var(--z-popover)] flex w-56 animate-fade-in flex-col overflow-hidden rounded-md border border-slate-200 bg-white/95 text-sm shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-slate-950/40"
            style={{
              left: pos?.left ?? 0,
              top: pos?.top ?? 0,
              ...(pos?.width ? { width: pos.width } : null),
              ...(pos?.minHeight ? { minHeight: pos.minHeight } : null),
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {/* Mobile only. On desktop the flyout sits BESIDE its parent, so
                the parent is still on screen and still shows which row is
                open — the panel needs no title and no way back. Covering the
                parent takes both of those away, so the header restores them:
                it says which category you are in, and Close is the way back
                to the menu underneath. */}
            {isMobile ? (
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
                  <span className="truncate">{title}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Close ${title}`}
                  onClick={() => setOpen(false)}
                  className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ) : null}
            {children}
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
