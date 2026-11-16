'use client';

// The element menu's Resources category (each product's docs/specs/008-canvas/element-menu-quick-bar.md "Resources"):
// what attaches to an element (its Action, Comments, Link and Note, whichever the app offers) in one side flyout,
// laid out as the footer's Tools rows are: no box of its own inside the flyout's, each row its glyph on a soft brand
// plate, its name and a quiet line under it. A row the element already has fills its plate and wears an "Added" badge,
// and reads View / Edit. Up, Down, Home and End move between rows; each closes the menu as it runs.
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useMenuKind } from '@liveworkspace/ui';
import { MenuFlyoutSection } from '../primitives/MenuFlyoutSection';

const ROW =
  'group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors duration-micro hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-400/50 motion-reduce:transition-none dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';
const PLATE =
  'flex size-8 shrink-0 items-center justify-center rounded-[9px] transition-colors duration-micro [&_svg]:size-4';
const PLATE_OFF =
  'bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-500/10 group-hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:group-hover:bg-brand-500/20';
const PLATE_ON = 'bg-brand-600 text-white shadow-sm dark:bg-brand-500';

export type ResourceItem = {
  key: string;
  // The verb, as the row reads: "Add Note", or "Edit Note" once it has one.
  label: string;
  icon: ReactNode;
  // Whether the element already has one.
  on: boolean;
  // The line under the name.
  detail: string;
  run: () => void;
};

// The glyph on the category's row: a paperclip, for what is attached to the element.
export function ResourcesMenuGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 7.5 8.2 12.3a3.2 3.2 0 0 1-4.5-4.5l5-5a2.1 2.1 0 0 1 3 3l-5 5a1.1 1.1 0 0 1-1.5-1.5L9.7 4.8" />
    </svg>
  );
}

export function ResourcesFlyout({
  items,
  flyout,
  onClose,
}: {
  items: readonly ResourceItem[];
  // The host scaffold's flyout state (useContextMenuScaffold's flyoutProps('resources')).
  flyout: { open?: boolean; onToggle?: (depth: number) => void; onOpen?: () => void };
  onClose: () => void;
}) {
  if (!items.length) return null;
  return (
    // A panel, so its one child (the list) is never promoted inline: Resources is always its own row, opening to the side.
    <MenuFlyoutSection title="Resources" icon={<ResourcesMenuGlyph />} panel {...flyout}>
      <ResourceRows items={items} onClose={onClose} />
    </MenuFlyoutSection>
  );
}

function ResourceRows({ items, onClose }: { items: readonly ResourceItem[]; onClose: () => void }) {
  const inMenu = useMenuKind() === 'command';
  const box = useRef<HTMLDivElement>(null);
  const move = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (inMenu) return;
    const all = [...(box.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = all.indexOf(e.currentTarget);
    const to =
      e.key === 'ArrowDown'
        ? Math.min(all.length - 1, at + 1)
        : e.key === 'ArrowUp'
          ? Math.max(0, at - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? all.length - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    e.stopPropagation();
    all[to]?.focus();
  };
  return (
    <div
      ref={box}
      role="group"
      aria-label="Resources"
      data-element-resources=""
      className="flex flex-col gap-0.5 p-1.5"
    >
      {items.map((i, n) => (
        <button
          key={i.key}
          type="button"
          role={inMenu ? 'menuitem' : undefined}
          tabIndex={inMenu ? -1 : n === 0 ? 0 : -1}
          data-option={i.key}
          className={ROW}
          onKeyDown={move}
          onClick={() => {
            i.run();
            onClose();
          }}
        >
          <span aria-hidden className={`${PLATE} ${i.on ? PLATE_ON : PLATE_OFF}`}>
            {i.icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium leading-5 text-slate-800 dark:text-slate-100">
              {i.label}
            </span>
            <span className="truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {i.detail}
            </span>
          </span>
          {i.on ? (
            <span
              data-resource-on=""
              className="shrink-0 rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30"
            >
              Added
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
