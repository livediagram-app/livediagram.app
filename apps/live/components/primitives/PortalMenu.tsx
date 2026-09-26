'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEventHandler,
  type ReactNode,
} from 'react';
import { ChevronDownIcon } from '@livediagram/ui';
import { Portal } from '@/components/primitives/Portal';
import { Tooltip } from '@/components/primitives/Tooltip';
import { clampToViewport } from '@/lib/clamp-to-viewport';
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
      // Clicks anywhere INSIDE the anchor (including its inner svg / text
      // nodes) are the trigger's own toggle to handle — closing here too
      // made the toggle reopen the menu it had just closed.
      if (
        e.target instanceof Node &&
        !ref.current.contains(e.target) &&
        !(anchor?.contains(e.target) ?? false)
      ) {
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
        <ChevronDownIcon
          className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
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

// A plain ACTION row: the same shape and rhythm as an accordion header
// (fixed icon slot, uppercase label, full width) but it performs a verb
// instead of expanding. For menus whose entries are things to DO rather than
// settings to open — e.g. the event-storming note menu (docs/specs/021-event-storming/event-storming.md), which is
// six verbs and no styling at all. Horizontal bars rather than a tile grid:
// a verb list reads down the menu like every other row here.
export function MenuActionRow({
  label,
  icon,
  onClick,
  onPointerEnter,
  onPointerLeave,
  danger = false,
  disabled = false,
  plain = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  // For a row whose result can be SHOWN before it is chosen: the Cleanup
  // layouts preview on hover (docs/specs/008-canvas/layout-cleanup.md), the same way the tiles above do.
  // Rows without a preview pass neither, and behave exactly as they did.
  onPointerEnter?: PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: PointerEventHandler<HTMLButtonElement>;
  // Sentence-case, 13px, full-contrast: the reading size for a menu
  // that IS the list (the diagram actions menu), where the uppercase
  // label rhythm of a category header is too quiet to scan eight verbs
  // by. A danger row is red at rest here, not only on hover.
  plain?: boolean;
  // Destructive verbs (Remove) tint on hover so the row reads before it is
  // clicked, matching the trash affordances elsewhere.
  danger?: boolean;
  // A verb that exists but can't run right now (Paste with an empty
  // clipboard). It STAYS in the menu, greyed: hiding it would change the
  // menu's shape based on state the user can't see, and they'd learn the
  // menu differently each time.
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled
        className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 dark:text-slate-600"
      >
        <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
        {label}
      </span>
    );
  }
  if (plain) {
    return (
      <button
        type="button"
        onClick={onClick}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] transition ${
          danger
            ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/15'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        <span
          className={`flex w-5 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 ${
            danger ? 'text-rose-500 dark:text-rose-300' : 'text-slate-400 dark:text-slate-400'
          }`}
        >
          {icon}
        </span>
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition ${
        danger
          ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300'
          : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300'
      }`}
    >
      <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}

// A quiet first row naming what the menu is FOR: the diagram's name and
// its visibility badge. A ⋯ menu opens away from its trigger (below a
// card, beside a row), and on a grid of near-identical cards the reader
// needs the menu itself to say which one they opened.
export function MenuHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-2 border-b border-slate-100 px-3 pb-2 pt-1.5 dark:border-slate-800">
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </span>
      {aside ? <span className="shrink-0">{aside}</span> : null}
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
  labelStyle,
  onClick,
  danger = false,
  disabled = false,
  active = false,
  preserveFocus = false,
  onPointerEnter,
  onPointerLeave,
}: {
  // Optional: omit for a label-only tile (e.g. a font name rendered in its
  // own face via labelStyle, which needs no separate swatch).
  icon?: ReactNode;
  label: string;
  // Inline style for the label span — e.g. `{ fontFamily }` so a font tile
  // previews itself.
  labelStyle?: CSSProperties;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  preserveFocus?: boolean;
  // Optional hover-preview handlers (pointerenter previews, pointerleave
  // reverts), matching the style-preset / marker tiles.
  onPointerEnter?: PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: PointerEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
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
      {icon !== undefined ? (
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
      ) : null}
      <span style={labelStyle}>{label}</span>
    </button>
  );
}

// Grid wrapper for MenuTile rows (2 / 3 / 4 equal columns).
export function MenuTileGrid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const colClass = cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
  // `auto-rows-fr` so a row with one wrapped label doesn't leave its
  // neighbours shorter: every tile in a row is the row's height.
  return <div className={`grid auto-rows-fr gap-1 px-2 py-1.5 ${colClass}`}>{children}</div>;
}
