'use client';

import { useRef, useState } from 'react';
import { elementKindLabel, type Element } from '@livediagram/diagram';
import { Tooltip } from '@/components/primitives/Tooltip';
import { PortalMenu, MenuItem } from '@/components/primitives/PortalMenu';

// One selectable bucket in the Filter Selection menu: a human label plus the
// ids of every selected element that belongs to it.
type FilterGroup = { key: string; label: string; ids: string[] };

// Pluralise a kind label for the menu ("Square" -> "Squares", "Sketch" ->
// "Sketches", "Sticky" -> "Stickies"). 'Text' is a mass noun, left as-is.
function pluralize(label: string): string {
  if (label === 'Text') return 'Text';
  if (/(?:s|x|z|ch|sh)$/i.test(label)) return `${label}es`;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

// Partition the selected elements into the buckets the filter menu offers.
// Shapes split by their kind (so Squares / Circles / Diamonds are each their
// own row, matching how a user thinks of them); every other element type is
// its own bucket. When the selection spans 2+ distinct shape kinds we also
// prepend a generic "All shapes" bucket so the user can grab every shape at
// once. Buckets are ordered by size (largest first) so the dominant type is
// the easiest to hit.
export function buildFilterGroups(elements: Element[]): FilterGroup[] {
  const byKind = new Map<string, { label: string; ids: string[] }>();
  const shapeIds: string[] = [];
  const shapeKinds = new Set<string>();
  for (const el of elements) {
    const key = el.type === 'shape' ? `shape:${el.shape}` : el.type;
    let entry = byKind.get(key);
    if (!entry) {
      entry = { label: pluralize(elementKindLabel(el)), ids: [] };
      byKind.set(key, entry);
    }
    entry.ids.push(el.id);
    if (el.type === 'shape') {
      shapeIds.push(el.id);
      shapeKinds.add(el.shape);
    }
  }
  const groups: FilterGroup[] = [...byKind.entries()]
    .map(([key, v]) => ({ key, label: v.label, ids: v.ids }))
    .sort((a, b) => b.ids.length - a.ids.length || a.label.localeCompare(b.label));
  if (shapeKinds.size >= 2) {
    groups.unshift({ key: 'all-shapes', label: 'All shapes', ids: shapeIds });
  }
  return groups;
}

type SelectionFilterMenuProps = {
  // The elements currently in the multi-selection.
  selectedElements: Element[];
  // Narrow the multi-selection down to `ids`.
  onFilter: (ids: Set<string>) => void;
};

// "Filter Selection" control for the marquee toolbar: a funnel button whose
// dropdown lists the kinds of element present in the selection. Picking one
// drops everything else from the selection, so a mixed marquee can be narrowed
// to just its Arrows / Squares / Text in a click. Hidden when there's nothing
// to narrow (a single-kind selection).
export function SelectionFilterMenu({ selectedElements, onFilter }: SelectionFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const groups = buildFilterGroups(selectedElements);
  // Nothing to filter when the selection is already a single kind.
  if (groups.length < 2) return null;

  return (
    <>
      <Tooltip title="Filter Selection" description="Keep only one kind of element.">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Filter selection by type"
          aria-haspopup="menu"
          aria-expanded={open}
          className={
            open
              ? 'flex h-7 w-7 items-center justify-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
              : 'flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }
        >
          <FilterIcon />
        </button>
      </Tooltip>
      {open ? (
        <PortalMenu anchor={buttonRef.current} placement="below" onClose={() => setOpen(false)}>
          {groups.map((g) => (
            <MenuItem
              key={g.key}
              icon={g.key === 'all-shapes' ? <ShapesIcon /> : <FilterIcon />}
              label={`${g.label} (${g.ids.length})`}
              onClick={() => {
                onFilter(new Set(g.ids));
                setOpen(false);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </>
  );
}

function FilterIcon() {
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
      <path d="M2.5 3.5h11l-4.25 5v4l-2.5 1.25v-5.25L2.5 3.5Z" />
    </svg>
  );
}

function ShapesIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="6" width="8" height="8" rx="1.25" />
      <circle cx="11" cy="5" r="3.25" />
    </svg>
  );
}
