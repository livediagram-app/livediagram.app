'use client';

import type { CSSProperties, PointerEventHandler, ReactNode } from 'react';
import { HoverCard } from '@livediagram/ui';
import { CountBadge } from '@livediagram/ui';
import { useMenuItemProps } from './menu-item-props';

// The tile family of the menu rows (PortalMenu.tsx holds the menu and its list rows): a toolbar of
// icon buttons, and icon-over-label tiles in a grid. Each takes its role from the menu it sits in
// (docs/specs/004-interface-design/menus.md): a menu item in a command menu, a button elsewhere.

// A compact icon-button row pinned to the top of a menu for the most
// common quick actions (lock / rename / duplicate), keeping them one
// glance away while the verbose actions move into labelled sections below.
export function MenuToolbar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5 px-2 pb-1 pt-0.5">{children}</div>;
}

type MenuToolButtonProps = {
  icon: ReactNode;
  // HoverCard title — also the accessible label, since the button is icon-only.
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
  // In a command menu: a menu item (checkable when it shows an on state), disabled by
  // aria-disabled so the roving keys still reach it (D50).
  const { inCommandMenu, itemProps } = useMenuItemProps({ disabled, checked: active });
  const tone = disabled
    ? 'cursor-not-allowed text-slate-300 dark:text-slate-400'
    : active
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300'
      : danger
        ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800';
  return (
    <HoverCard title={label} description={description}>
      <button
        type="button"
        {...itemProps}
        onClick={inCommandMenu && disabled ? undefined : onClick}
        disabled={inCommandMenu ? undefined : disabled}
        aria-label={label}
        aria-pressed={inCommandMenu ? undefined : active}
        // h-8 w-8 + forced 16px icons to match the canvas element toolbar
        // (SelectionPopover); the `[&_svg]` override beats each glyph's
        // intrinsic width/height attribute.
        className={`flex h-8 w-8 items-center justify-center rounded transition [&_svg]:h-4 [&_svg]:w-4 ${tone}`}
      >
        {icon}
      </button>
    </HoverCard>
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
  count,
  labelStyle,
  onClick,
  danger = false,
  disabled = false,
  active,
  preserveFocus = false,
  onPointerEnter,
  onPointerLeave,
}: {
  // Optional: omit for a label-only tile (e.g. a font name rendered in its
  // own face via labelStyle, which needs no separate swatch).
  icon?: ReactNode;
  label: string;
  // How many things the tile acts on, shown as a badge beside the label
  // (docs/specs/004-interface-design/counts.md), never in brackets.
  count?: number;
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
  // In a command menu: a menu item, checkable when the tile shows an on state (`active`), and
  // disabled by aria-disabled so the roving keys still reach it (D50).
  const { inCommandMenu, itemProps } = useMenuItemProps({ disabled, checked: active });
  return (
    <button
      type="button"
      {...itemProps}
      onClick={inCommandMenu && disabled ? undefined : onClick}
      onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      disabled={inCommandMenu ? undefined : disabled}
      aria-pressed={inCommandMenu ? undefined : active}
      className={`flex cursor-pointer flex-col items-center justify-start gap-1.5 rounded-md px-1.5 py-2 text-center text-[11px] font-medium leading-tight transition disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 ${
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
      <span style={labelStyle}>
        {label}
        {count !== undefined ? <CountBadge count={count} className="ml-1 align-middle" /> : null}
      </span>
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
