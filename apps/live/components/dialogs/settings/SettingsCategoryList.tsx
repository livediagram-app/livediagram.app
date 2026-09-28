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

// The category list, in both of its jobs: the ROOT SCREEN on a phone (tap a
// row to push its pane) and the SIDEBAR on desktop (click a row to swap the
// pane beside it). One component for both because the row is the same row ,
// only the chevron and the selected highlight differ, and splitting it would
// be how the two drift apart.
//
// A category with sub-categories (Panels: Layers, Activity, Map) is an
// ACCORDION: its sub-categories sit indented beneath it (a plain glyph, no
// tile) only while it is expanded, so they do not take up the list all the
// time. It starts
// collapsed, and is held open while one of its sub-categories is the current
// pane or holds a search hit, so neither is ever hidden. A disclosure chevron
// on the parent toggles it in both layouts; on desktop the parent's own row
// does too (see `activateParent`), while on a phone that row pushes its pane.
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
  const childrenOf = (id: string) => categories.filter((c) => c.parent === id);
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
  // has just hidden. A phone keeps the row for navigation (it pushes the
  // parent's pane) and folds with the chevron alone.
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
    if (childrenOf(category.id).some((c) => c.id === selected)) onSelect(category.id);
  };

  return (
    <nav
      aria-label="Settings categories"
      className={
        isRoot
          ? 'flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700'
          : 'flex flex-col gap-0.5 p-2'
      }
    >
      {categories.map((category) => {
        if (category.parent) return null; // Drawn beneath its parent.
        const children = childrenOf(category.id);
        // Held open while a sub-category is current or holds a search hit.
        const open =
          children.length > 0 &&
          (expanded.has(category.id) ||
            children.some((c) => c.id === selected) ||
            (searching === true && children.some((c) => (c.matchCount ?? 0) > 0)));
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
              nested={false}
              current={selected === category.id}
              count={category.matchCount ?? 0}
              // A parent stays reachable while its sub-categories match, even
              // when its own rows do not: it is the way down to them.
              reachable={children.some((c) => (c.matchCount ?? 0) > 0)}
              searching={searching}
              isRoot={isRoot}
              onClick={() => activateParent(category, open)}
              disclosure={{
                open,
                controls: listId,
                label: `${open ? 'Hide' : 'Show'} ${category.label} sub-categories`,
                // Nothing to fold while it is held open.
                locked: open && !expanded.has(category.id),
                onToggle: () => toggle(category.id),
              }}
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

// One row of the list: a category, or (nested) a sub-category. A nested row
// is indented by about half a tile, so its plain glyph starts inside the
// parent's tile column and its label a little inside the parent's label:
// enough to read as nested, without the deep indent of lining the glyph up
// under the parent's label. A parent row carries a disclosure chevron beside
// its main button (a sibling, since a button cannot hold a button).
function CategoryRow({
  label,
  icon,
  nested,
  current,
  count,
  reachable = false,
  searching,
  isRoot,
  onClick,
  disclosure,
}: {
  label: string;
  icon: ReactNode;
  nested: boolean;
  current: boolean;
  count: number;
  reachable?: boolean;
  searching?: boolean;
  isRoot: boolean;
  onClick: () => void;
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
      aria-expanded={disclosure && !isRoot ? disclosure.open : undefined}
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
          on screen, so a "there's more this way" arrow would lie. A parent
          row leaves it to its disclosure chevron: two side by side would
          read as one control drawn twice. */}
      {isRoot && !disclosure ? <NavChevron className="text-slate-400" /> : null}
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
        className={`flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-700 disabled:cursor-default disabled:opacity-40 disabled:hover:text-slate-400 dark:hover:text-slate-200 ${
          isRoot ? 'mr-1.5' : 'mr-0.5'
        }`}
      >
        <NavChevron
          className={`transition-transform motion-reduce:transition-none ${disclosure.open ? 'rotate-90' : ''}`}
        />
      </button>
    </div>
  );
}
