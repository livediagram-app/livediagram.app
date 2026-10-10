'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';
import {
  ChevronDownIcon,
  MENU_LABEL_ATTR,
  MenuTreeContext,
  useControlMenu,
  useMenu,
  useMenuKind,
  type MenuInitialFocus,
  type MenuKind,
  type MenuTree,
  Portal,
} from '@livediagram/ui';
import { useMenuItemProps } from './menu-item-props';
import {
  PLACEMENT_TRANSFORM,
  usePortalMenuPlacement,
  type PortalMenuPlacement,
} from './usePortalMenuPlacement';

type PortalMenuBase = {
  anchor: HTMLElement | null;
  placement?: PortalMenuPlacement;
  onClose: () => void;
  children: ReactNode;
  // A wider menu for rows that carry a line under their name (the Sheet's function menus): 20rem, not 14.
  wide?: boolean;
};

// A command menu (the default) or, when it holds a control, a control menu
// (docs/specs/004-interface-design/menus.md). A control menu names itself.
type PortalMenuProps = PortalMenuBase & {
  surface?: MenuKind;
  // Required in practice for a control menu; a command menu is named by its header or anchor.
  label?: string;
  initialFocus?: MenuInitialFocus;
};

/**
 * Floating menu rendered through `createPortal` to `document.body`.
 * Anchored to an arbitrary element via its bounding rect; auto-clamps to the
 * viewport edges; closes when the user clicks outside the menu.
 *
 * The anchor is its trigger: it names the menu (unless a MenuHeader does),
 * points at it with aria-controls, and takes focus back when it closes.
 */
export function PortalMenu(props: PortalMenuProps) {
  if (props.surface !== 'control') return <CommandPortalMenu {...props} />;
  const { label, ...rest } = props;
  return <ControlPortalMenu {...rest} label={label ?? 'Menu'} />;
}

function CommandPortalMenu({
  anchor,
  placement = 'below',
  onClose,
  children,
  label,
  initialFocus,
  wide,
}: PortalMenuBase & { label?: string; initialFocus?: MenuInitialFocus }) {
  const { attach, element, tree, surfaceProps } = useMenu({
    onClose,
    trigger: anchor,
    label,
    initialFocus,
  });
  const at = usePortalMenuPlacement(anchor, placement, element, onClose);
  return (
    <PortalMenuFrame
      at={at}
      placement={placement}
      attach={attach}
      tree={tree}
      surfaceProps={surfaceProps}
      wide={wide}
    >
      {children}
    </PortalMenuFrame>
  );
}

function ControlPortalMenu({
  anchor,
  placement = 'below',
  onClose,
  children,
  label,
  wide,
}: PortalMenuBase & { label: string }) {
  const { attach, element, tree, surfaceProps } = useControlMenu({
    onClose,
    trigger: anchor,
    label,
  });
  const at = usePortalMenuPlacement(anchor, placement, element, onClose);
  return (
    <PortalMenuFrame
      at={at}
      placement={placement}
      attach={attach}
      tree={tree}
      surfaceProps={surfaceProps}
      wide={wide}
    >
      {children}
    </PortalMenuFrame>
  );
}

function PortalMenuFrame({
  at,
  placement,
  attach,
  tree,
  surfaceProps,
  wide = false,
  children,
}: {
  at: { left: number; top: number } | null;
  placement: PortalMenuPlacement;
  attach: (el: HTMLElement | null) => void;
  tree: MenuTree;
  surfaceProps: object;
  wide?: boolean | undefined;
  children: ReactNode;
}) {
  if (!at) return null;
  return (
    <Portal>
      <MenuTreeContext.Provider value={tree}>
        <div
          ref={attach}
          {...surfaceProps}
          className={`fixed z-[var(--z-popover)] flex ${wide ? 'w-80' : 'w-56'} animate-fade-in flex-col rounded-md border border-slate-200 bg-white/90 py-1 text-sm shadow-lg outline-none backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-slate-950/40`}
          style={{ left: at.left, top: at.top, transform: PLACEMENT_TRANSFORM[placement] }}
        >
          {children}
        </div>
      </MenuTreeContext.Provider>
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
  // In a command menu the header is an item that discloses a group of items it labels; collapsed,
  // the group is inert in either kind of menu, so neither Tab nor the arrows reach hidden rows.
  const { inCommandMenu, itemProps } = useMenuItemProps();
  const headerId = useId();
  return (
    <div
      className={flush ? '' : 'border-t border-slate-100 first:border-t-0 dark:border-slate-800'}
    >
      <button
        type="button"
        id={headerId}
        {...itemProps}
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
          className={`transition-transform duration-short ${open ? '' : '-rotate-90'}`}
        />
      </button>
      <div
        role={inCommandMenu ? 'group' : undefined}
        aria-labelledby={inCommandMenu ? headerId : undefined}
        // Collapsed is invisible (opacity 0, no height): inert keeps it out of the focus order,
        // aria-hidden out of every accessibility tree, inert support or not.
        inert={!open}
        aria-hidden={!open || undefined}
        className={`grid transition-all duration-short ease-out ${
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
  disabled = false,
  plain = false,
  labelStyle,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  // The label's own look (a font menu draws each font's name in that font).
  labelStyle?: CSSProperties;
  // Sentence-case, 13px, full-contrast: the reading size for a menu
  // that IS the list (the document actions menu), where the uppercase
  // label rhythm of a category header is too quiet to scan eight verbs
  // by. A Delete or Trash row looks like every other row (never red).
  plain?: boolean;
  // A verb that exists but can't run right now (Paste with an empty
  // clipboard). It STAYS in the menu, greyed: hiding it would change the
  // menu's shape based on state the user can't see, and they'd learn the
  // menu differently each time.
  disabled?: boolean;
}) {
  const { itemProps } = useMenuItemProps({ disabled });
  if (disabled && plain) {
    // A command menu keeps it as a focusable, announced item that does nothing (D50). A plain row
    // keeps its own reading size and layout, only greyed, so the list doesn't change shape.
    return (
      <span
        aria-disabled
        {...itemProps}
        className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-2 text-[13px] text-slate-300 dark:text-slate-600"
      >
        <span className="flex w-5 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        {label}
      </span>
    );
  }
  if (disabled) {
    // A command menu keeps it as a focusable, announced item that does nothing (D50).
    return (
      <span
        aria-disabled
        {...itemProps}
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
        {...itemProps}
        onClick={onClick}
        className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] transition ${'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
      >
        <span
          className={`flex w-5 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 ${'text-slate-400 dark:text-slate-400'}`}
        >
          {icon}
        </span>
        {labelStyle ? <span style={labelStyle}>{label}</span> : label}
      </button>
    );
  }
  return (
    <button
      type="button"
      {...itemProps}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition ${'text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-300'}`}
    >
      <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}

// A quiet first row naming what the menu is FOR: the document's name and
// its visibility badge. A ⋯ menu opens away from its trigger (below a
// card, beside a row), and on a grid of near-identical cards the reader
// needs the menu itself to say which one they opened.
//
// In a command menu it names the menu (aria-labelledby, docs/specs/004-interface-design/menus.md)
// and is hidden as content, so it is read once, as the menu's name, and never focused.
export function MenuHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  const inCommandMenu = useMenuKind() === 'command';
  const id = useId();
  return (
    <div
      aria-hidden={inCommandMenu || undefined}
      className="mb-1 flex items-center gap-2 border-b border-slate-100 px-3 pb-2 pt-1.5 dark:border-slate-800"
    >
      {/* The title alone names the menu; the aside (a visibility badge) is decoration here. */}
      <span
        id={id}
        {...(inCommandMenu ? { [MENU_LABEL_ATTR]: '' } : null)}
        className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-200"
      >
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
  // A command menu announces its separators between groups of items.
  const inCommandMenu = useMenuKind() === 'command';
  return (
    <div className="my-1.5 px-2" role="separator" aria-hidden={inCommandMenu ? undefined : true}>
      <div className="h-px bg-slate-200/90 dark:bg-slate-700/80" />
    </div>
  );
}

// A full-width, outlined action button for the bottom of a menu section —
// the "Reset to theme / default", "Reset aspect ratio", "Apply to all
// elements" style buttons. One definition so the (long) outlined-button
// styling can't drift across the context menu, style presets, and tab menu.
// The caller supplies its own surrounding padding wrapper.
export function MenuActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  // Drawn before the label.
  icon?: ReactNode;
  onClick: () => void;
}) {
  const { itemProps } = useMenuItemProps();
  return (
    <button
      type="button"
      {...itemProps}
      onClick={onClick}
      className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
    >
      {icon}
      {label}
    </button>
  );
}
