'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { EllipsisIcon, Tooltip } from '@liveworkspace/ui';
import { MenuActionRow, MenuHeader, PortalMenu } from '../primitives/PortalMenu';

// The category bar's More (docs/specs/007-editor/toolbar-layout.md "The strip's room"): the categories a strip too
// narrow for its room folds away (useBarFold), behind one button at the bar's end, drawn as a category button is.
// A press lists them; choosing one opens its flyout under More, which stays lit while it is open, as a category's
// own button does.

export const MORE_CATEGORIES_LABEL = 'More Categories';

export type FoldedCategory = { id: string; label: string; icon: ReactNode };

export function CategoryBarMore({
  folded,
  active,
  register,
  onOpenMenu,
  onChoose,
  onKeyDown,
}: {
  folded: readonly FoldedCategory[];
  // A folded category's flyout is open, hung under More.
  active: boolean;
  // The bar keeps More with its buttons: its flyouts anchor to it, and the arrow keys reach it.
  register: (el: HTMLButtonElement | null) => void;
  // The list opens: an open flyout closes first.
  onOpenMenu: () => void;
  // A category chosen from the list, by the keyboard (its flyout then focuses its first tile) or a press.
  onChoose: (id: string, keyboard: boolean) => void;
  // The bar's own arrow keys (Left, Right), beside More's Down.
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const show = (button: HTMLButtonElement) => {
    onOpenMenu();
    setAnchor(button);
    setOpen(true);
  };
  const lit = open || active;
  return (
    <>
      <Tooltip label={MORE_CATEGORIES_LABEL}>
        <button
          ref={register}
          type="button"
          data-category-bar-button=""
          data-category-bar-more=""
          aria-label={MORE_CATEGORIES_LABEL}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => (open ? setOpen(false) : show(e.currentTarget))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              show(e.currentTarget);
              return;
            }
            onKeyDown?.(e);
          }}
          className={`relative flex h-9 w-9 shrink-0 cursor-pointer touch-target-y items-center justify-center rounded-lg transition phone:w-11 ${
            lit
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <EllipsisIcon size={18} />
          {/* The open category's marker, as under a category's own button. */}
          <span
            aria-hidden
            className={`absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-brand-500 transition-opacity duration-micro ${active ? 'opacity-100' : 'opacity-0'}`}
          />
        </button>
      </Tooltip>
      {open ? (
        <PortalMenu
          anchor={anchor}
          placement="below-start"
          onClose={() => setOpen(false)}
          landmark={MORE_CATEGORIES_LABEL}
        >
          <MenuHeader title={MORE_CATEGORIES_LABEL} />
          {folded.map((c) => (
            <MenuActionRow
              key={c.id}
              plain
              icon={
                <span className="flex h-4 w-4 items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full">
                  {c.icon}
                </span>
              }
              label={c.label}
              onClick={(e) => {
                setOpen(false);
                onChoose(c.id, e.detail === 0);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </>
  );
}
