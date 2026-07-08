'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { Tooltip } from '@/components/primitives/Tooltip';
import { clampToViewport, VIEWPORT_EDGE_MARGIN } from '@/lib/clamp-to-viewport';
import { useReposition } from '@/hooks/canvas/useReposition';

type Placement = 'above' | 'below';

type PortalMenuProps = {
  anchor: HTMLElement | null;
  placement?: Placement;
  onClose: () => void;
  children: ReactNode;
};

// Right-align the menu's right edge with the anchor's right edge and place
// it above or below, with a small gap.
const PLACEMENT_TRANSFORM: Record<Placement, string> = {
  above: 'translate(-100%, calc(-100% - 4px))',
  below: 'translate(-100%, 4px)',
};

/**
 * Floating context menu rendered through `createPortal` to `document.body`.
 * Anchored to an arbitrary element via its bounding rect; auto-clamps to the
 * viewport edges; closes when the user clicks outside the menu.
 *
 * Used by the tab bar (above the ellipsis button) and the editor header
 * (below the diagram-title ellipsis button).
 */
export function PortalMenu({ anchor, placement = 'below', onClose, children }: PortalMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  useReposition(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({
      left: r.right,
      top: placement === 'below' ? r.bottom : r.top,
    });
  }, [anchor, placement]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !pos) return;
    const next = clampToViewport(node.getBoundingClientRect(), adjust);
    if (next.x !== adjust.x || next.y !== adjust.y) setAdjust(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      // A MenuFlyoutSection portals its panel outside this menu but marks it
      // data-menu-flyout, so clicks inside the flyout count as inside the menu.
      if (e.target instanceof Element && e.target.closest('[data-menu-flyout]')) return;
      if (e.target instanceof Node && !ref.current.contains(e.target) && e.target !== anchor) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchor]);

  if (!pos) return null;

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        className="fixed z-[var(--z-popover)] flex w-56 animate-fade-in flex-col rounded-md border border-slate-200 bg-white/90 py-1 text-sm shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-slate-950/40"
        style={{
          left: pos.left + adjust.x,
          top: pos.top + adjust.y,
          transform: PLACEMENT_TRANSFORM[placement],
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

type MenuItemProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function MenuItem({ icon, label, onClick, danger, disabled }: MenuItemProps) {
  const base =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition';
  const tone = disabled
    ? 'cursor-not-allowed text-slate-300 dark:text-slate-400'
    : danger
      ? 'cursor-pointer text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/15'
      : 'cursor-pointer text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${tone}`}>
      <span
        className={
          disabled
            ? 'text-slate-300 dark:text-slate-400'
            : danger
              ? 'text-rose-600 dark:text-rose-300'
              : 'text-slate-400 dark:text-slate-400'
        }
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

// A collapsible category inside a menu: an uppercase header (icon + chevron)
// that toggles its content. Controlled by the parent so only one section is
// open at a time. The border-t (with `first:border-t-0`) butts the header up
// to a flush separator, and the content height animates via the grid-rows
// 0fr<->1fr trick (no fixed height needed). Shared by the element context
// menu + the tab menu so both read alike.
export function MenuAccordionSection({
  title,
  icon,
  open,
  onToggle,
  children,
  // When true the header preventDefaults mousedown so it can't steal focus
  // from a contentEditable behind it (the rich-text toolbar's ⋯ menu needs
  // the live text selection to survive a category toggle).
  preserveFocus = false,
  // When true the section draws no top border. Used where the parent supplies
  // its own grouping separators (the editor context menu bands rows into
  // groups), so adjacent rows sit flush instead of each carrying a hairline.
  flush = false,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  preserveFocus?: boolean;
  flush?: boolean;
}) {
  return (
    <div
      className={flush ? '' : 'border-t border-slate-100 first:border-t-0 dark:border-slate-800'}
    >
      <button
        type="button"
        onClick={onToggle}
        onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
      >
        <span className="flex items-center gap-2">
          {/* Fixed-width, centred icon slot so every category title starts at
              the same x regardless of the glyph's own width. */}
          <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
          {title}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        >
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden bg-slate-50/70 dark:bg-slate-800/30">
          <div className="py-1.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

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
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  flush?: boolean;
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
          setPos(null);
          setOpen((v) => !v);
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
        {/* Right chevron — signals the section opens to the side, not down. */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4.5 3 7.5 6 4.5 9" />
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

// Band separator between groups of accordion categories (e.g. the editor
// context menu's placement / appearance / content / collaboration bands, or
// the tab menu's organise / look-and-feel / session bands). Stronger than a
// per-row hairline and slightly inset, so when rows render `flush` the
// grouping reads at a glance. Pair with `flush` sections + parent-supplied
// gating so an absent band leaves no dangling rule.
export function MenuGroupSeparator() {
  return (
    <div className="my-1.5 px-2" role="separator" aria-hidden>
      <div className="h-px bg-slate-200/90 dark:bg-slate-700/80" />
    </div>
  );
}

// A full-width, outlined action button for the bottom of a menu section —
// the "Reset to theme / default", "Reset aspect ratio", "Apply to all
// elements" style buttons. One definition so the (long) outlined-button
// styling can't drift across the context menu, style presets, and tab menu.
// The caller supplies its own surrounding padding wrapper.
export function MenuActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
    >
      {label}
    </button>
  );
}

// A compact icon-button row pinned to the top of a menu for the most
// common quick actions (lock / rename / duplicate), keeping them one
// glance away while the verbose actions move into labelled sections below.
export function MenuToolbar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5 px-2 pb-1 pt-0.5">{children}</div>;
}

type MenuToolButtonProps = {
  icon: ReactNode;
  // Tooltip title — also the accessible label, since the button is icon-only.
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  // Highlight a toggle whose state is "on" (e.g. a locked tab).
  active?: boolean;
  // Destructive action (e.g. Delete) — rose tone, matching MenuItem.
  danger?: boolean;
};

export function MenuToolButton({
  icon,
  label,
  description,
  onClick,
  disabled,
  active,
  danger,
}: MenuToolButtonProps) {
  const tone = disabled
    ? 'cursor-not-allowed text-slate-300 dark:text-slate-400'
    : active
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
      : danger
        ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';
  return (
    <Tooltip title={label} description={description}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        // h-8 w-8 + forced 16px icons to match the canvas element toolbar
        // (SelectionPopover); the `[&_svg]` override beats each glyph's
        // intrinsic width/height attribute.
        className={`flex h-8 w-8 items-center justify-center rounded transition [&_svg]:h-4 [&_svg]:w-4 ${tone}`}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

// A tile button: icon stacked OVER its label, centred. The action shape
// menus use so they read as a grid of buttons rather than a list of rows.
// `danger` tints it red (Delete); `active` gives it the brand-fill pressed
// tone. `preserveFocus` preventDefaults mousedown so clicking it can't blur a
// contentEditable behind it (the rich-text toolbar's menu needs the live
// selection to survive). Shared by the editor context menu + rich-text menu.
export function MenuTile({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
  active = false,
  preserveFocus = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  preserveFocus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
      disabled={disabled}
      aria-pressed={active}
      className={`flex cursor-pointer flex-col items-center justify-start gap-1.5 rounded-md px-1.5 py-2 text-center text-[11px] font-medium leading-tight transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/15'
          : active
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <span
        className={
          danger
            ? 'text-rose-500 dark:text-rose-300'
            : active
              ? ''
              : 'text-slate-400 dark:text-slate-400'
        }
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

// Grid wrapper for MenuTile rows (2 / 3 / 4 equal columns).
export function MenuTileGrid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const colClass = cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
  return <div className={`grid gap-1 px-2 py-1.5 ${colClass}`}>{children}</div>;
}
