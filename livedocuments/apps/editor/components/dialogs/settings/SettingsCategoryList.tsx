'use client';

import { useState, type ReactNode } from 'react';
import type { SettingsCategorySpec } from './settings-catalogue';
import { NavChevron } from '@/components/primitives/NavChevron';
import {
  SettingsCategoryIcon,
  SettingsSubcategoryIcon,
  type SettingsIconId,
  type SettingsSubcategoryId,
} from './settings-icons';

type ListCategory = SettingsCategorySpec & { matchCount?: number };

// The phone's grouped card: the root list, and a parent pane's sub-category
// links, which read as the same navigation one level in.
const ROOT_CARD =
  'flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700';

function childrenOf<C extends SettingsCategorySpec>(categories: readonly C[], id: string): C[] {
  return categories.filter((c) => c.parent === id);
}

// The category list, in both of its jobs: the ROOT SCREEN on a phone (tap a
// row to push its pane) and the SIDEBAR on desktop (click a row to swap the
// pane beside it). One component for both because the row is the same row ,
// only the chevron and the selected highlight differ, and splitting it would
// be how the two drift apart.
//
// A category with sub-categories (Panels, one per panel; Editor, Draw) is an
// ACCORDION: its sub-categories sit indented beneath it (a plain glyph, no
// tile) only while it is expanded, so they do not take up the list all the
// time. It starts collapsed, and is held open while one of its sub-categories is the current
// pane or holds a search hit, so neither is ever hidden. On desktop the
// parent's row and a disclosure chevron beside it both toggle it (see
// `activateParent`). A phone has no accordion to work: the parent is an
// ordinary row that pushes its pane, and that pane lists the sub-categories
// (`SettingsSubcategoryLinks`), the way iOS Settings nests a screen. Its
// sub-categories only show beneath it on the root list for a search hit.
export function SettingsCategoryList({
  categories,
  selected,
  onSelect,
  variant,
  searching,
}: {
  categories: ListCategory[];
  // Which row reads as current. Always null on the phone root screen: nothing
  // is "selected" there, you are choosing where to go.
  selected: string | null;
  onSelect: (id: SettingsCategorySpec['id']) => void;
  // 'root' = the phone's first screen (chevrons, grouped card).
  // 'sidebar' = the desktop rail beside the pane (highlight, no chevrons).
  variant: 'root' | 'sidebar';
  // While searching, each row shows how many of its settings match, and a
  // category with none is dimmed and unclickable: the badge is the answer to
  // "which category was it in?", which is the question search is really for.
  searching?: boolean;
}) {
  const isRoot = variant === 'root';
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Desktop: the parent row opens its own pane and its sub-categories; a
  // second click folds them away again, handing the selection back to the
  // parent if a sub-category held it, so the open pane is never one the list
  // has just hidden. A phone keeps the row for navigation: it pushes the
  // parent's pane.
  const activateParent = (category: ListCategory, open: boolean) => {
    if (isRoot) {
      onSelect(category.id);
      return;
    }
    if (!open) {
      setExpanded((prev) => new Set(prev).add(category.id));
      onSelect(category.id);
      return;
    }
    toggle(category.id);
    if (childrenOf(categories, category.id).some((c) => c.id === selected)) onSelect(category.id);
  };

  return (
    <nav
      aria-label="Settings categories"
      className={isRoot ? ROOT_CARD : 'flex flex-col gap-0.5 p-2'}
    >
      {categories.map((category) => {
        if (category.parent) return null; // Drawn beneath its parent.
        const children = childrenOf(categories, category.id);
        // Held open while a sub-category holds a search hit or (on the
        // sidebar, the only list with a selection or a disclosure) is current.
        const searchHit = searching === true && children.some((c) => (c.matchCount ?? 0) > 0);
        const open =
          children.length > 0 &&
          (searchHit ||
            (!isRoot && (expanded.has(category.id) || children.some((c) => c.id === selected))));
        const rowFor = (c: ListCategory, nested: boolean) => (
          <CategoryRow
            key={c.id}
            label={c.label}
            icon={
              nested ? (
                <SettingsSubcategoryIcon id={c.id as SettingsSubcategoryId} />
              ) : (
                <SettingsCategoryIcon id={c.id as SettingsIconId} />
              )
            }
            nested={nested}
            current={selected === c.id}
            count={c.matchCount ?? 0}
            searching={searching}
            isRoot={isRoot}
            onClick={() => onSelect(c.id)}
          />
        );
        if (children.length === 0) return rowFor(category, false);
        const listId = `settings-subcategories-${category.id}`;
        return (
          <div key={category.id} className="flex flex-col gap-0.5">
            <CategoryRow
              label={category.label}
              icon={<SettingsCategoryIcon id={category.id as SettingsIconId} />}
              current={selected === category.id}
              count={category.matchCount ?? 0}
              // A parent stays reachable while its sub-categories match, even
              // when its own rows do not: it is the way down to them.
              reachable={children.some((c) => (c.matchCount ?? 0) > 0)}
              searching={searching}
              isRoot={isRoot}
              onClick={() => activateParent(category, open)}
              // A phone gets no disclosure: its right-pointing chevron read as
              // the row's own "go" arrow, so the sub-categories behind it went
              // unfound. The pushed pane lists them instead.
              disclosure={
                isRoot
                  ? undefined
                  : {
                      open,
                      controls: listId,
                      label: `${open ? 'Hide' : 'Show'} ${category.label} sub-categories`,
                      // Nothing to fold while it is held open.
                      locked: open && !expanded.has(category.id),
                      onToggle: () => toggle(category.id),
                    }
              }
            />
            {open ? (
              <div
                id={listId}
                role="group"
                aria-label={category.label}
                className={
                  isRoot
                    ? 'flex flex-col divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800'
                    : 'flex flex-col gap-0.5'
                }
              >
                {children.map((c) => rowFor(c, true))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

// A parent's sub-categories as rows at the foot of its pushed pane on a
// phone, each pushing its own pane: the phone's way down to them.
export function SettingsSubcategoryLinks({
  parent,
  categories,
  onSelect,
}: {
  parent: SettingsCategorySpec;
  categories: readonly SettingsCategorySpec[];
  onSelect: (id: SettingsCategorySpec['id']) => void;
}) {
  const children = childrenOf(categories, parent.id);
  if (children.length === 0) return null;
  return (
    <nav aria-label={`${parent.label} sub-categories`} className={`mt-6 ${ROOT_CARD}`}>
      {children.map((c) => (
        <CategoryRow
          key={c.id}
          label={c.label}
          icon={<SettingsSubcategoryIcon id={c.id as SettingsSubcategoryId} />}
          isRoot
          onClick={() => onSelect(c.id)}
        />
      ))}
    </nav>
  );
}

// One row of the list: a category, or (nested) a sub-category. A nested row
// is indented by about half a tile, so its plain glyph starts inside the
// parent's tile column and its label a little inside the parent's label:
// enough to read as nested, without the deep indent of lining the glyph up
// under the parent's label. A parent row on the sidebar carries a disclosure
// chevron beside its main button (a sibling, since a button cannot hold a
// button); the phone's root list has none.
function CategoryRow({
  label,
  icon,
  nested = false,
  current = false,
  count = 0,
  reachable = false,
  searching,
  isRoot,
  onClick,
  disclosure,
}: {
  label: string;
  icon: ReactNode;
  nested?: boolean;
  current?: boolean;
  count?: number;
  reachable?: boolean;
  searching?: boolean;
  isRoot: boolean;
  onClick: () => void;
  // Sidebar only.
  disclosure?: {
    open: boolean;
    controls: string;
    label: string;
    locked: boolean;
    onToggle: () => void;
  };
}) {
  const empty = searching === true && count === 0 && !reachable;
  const lit = !isRoot && current;
  // The row's background (hover, and the current highlight on the sidebar).
  // A parent row paints it on the wrapper holding both of its buttons, so
  // the box takes in the disclosure chevron rather than stopping short of it.
  const surface = isRoot
    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
    : `rounded-lg ${
        lit
          ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
      }`;
  const button = (
    <button
      type="button"
      disabled={empty}
      onClick={onClick}
      aria-expanded={disclosure?.open}
      // The sidebar is a set of alternatives with one current, which is
      // what aria-current names. The root list is navigation, so its
      // rows make no such claim.
      aria-current={lit ? 'page' : undefined}
      className={`flex min-w-0 flex-1 items-center gap-3 text-left transition ${
        empty ? 'cursor-default opacity-40' : ''
      } ${
        isRoot
          ? nested
            ? 'py-2 pr-3 pl-[34px]'
            : 'px-3 py-2.5'
          : nested
            ? 'py-1.5 pr-2.5 pl-8'
            : 'px-2.5 py-2'
      } ${disclosure ? '' : surface}`}
    >
      {icon}
      <span
        className={`text-optical-line flex-1 truncate text-sm font-medium ${
          lit ? 'text-brand-800 dark:text-brand-100' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {label}
      </span>
      {searching && count > 0 ? (
        <span className="inline-flex h-[19px] shrink-0 items-center rounded-full bg-brand-100 px-1.5 text-[10px] font-semibold tabular-nums text-brand-700 dark:bg-brand-500/25 dark:text-brand-100">
          <span className="text-optical-centre">{count}</span>
        </span>
      ) : null}
      {/* Only the phone root screen gets a chevron: it is the one that
          actually goes somewhere. On the sidebar the pane is already
          on screen, so a "there's more this way" arrow would lie. */}
      {isRoot ? <NavChevron className="text-slate-400" /> : null}
    </button>
  );
  if (!disclosure) return button;
  return (
    <div className={`flex items-center transition ${surface}`}>
      {button}
      <button
        type="button"
        onClick={disclosure.onToggle}
        disabled={disclosure.locked}
        aria-expanded={disclosure.open}
        aria-controls={disclosure.controls}
        aria-label={disclosure.label}
        className="mr-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-700 disabled:cursor-default disabled:opacity-40 disabled:hover:text-slate-400 dark:hover:text-slate-200"
      >
        <NavChevron
          className={`transition-transform motion-reduce:transition-none ${disclosure.open ? 'rotate-90' : ''}`}
        />
      </button>
    </div>
  );
}
