'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
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
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  flush?: boolean;
  onOpen?: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Place the flyout beside the trigger row: to the right when it fits, else
  // to the left. Top-aligned with the row, clamped inside the viewport. Runs
  // before paint (useReposition) and again on scroll / resize / content grow.
  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const tr = trigger.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const m = VIEWPORT_EDGE_MARGIN;
    const gap = 2;
    const fitsRight = tr.right + gap + pr.width + m <= window.innerWidth;
    const rawLeft = fitsRight ? tr.right + gap : tr.left - gap - pr.width;
    const left = Math.max(m, Math.min(rawLeft, window.innerWidth - pr.width - m));
    const top = Math.max(m, Math.min(tr.top, window.innerHeight - pr.height - m));
    setPos((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
  }, []);

  useReposition(() => {
    if (open) measure();
  }, [open, measure]);

  // Re-clamp when a section inside the flyout expands and grows the panel.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(panel);
    return () => ro.disconnect();
  }, [open, measure]);

  // Close the flyout on a click that's neither on its trigger nor inside its
  // panel — i.e. another menu row, or off the menu entirely. The host menu
  // keeps itself open for clicks inside the panel via the data-menu-flyout
  // marker, so the two guards don't fight.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

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
            className="fixed z-[var(--z-overlay)] flex w-56 animate-fade-in flex-col overflow-hidden rounded-md border border-slate-200 bg-white/95 text-sm shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-slate-950/40"
            style={{
              left: pos?.left ?? 0,
              top: pos?.top ?? 0,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {children}
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
