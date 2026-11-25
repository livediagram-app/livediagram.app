'use client';

import { lazyPanel } from '@liveworkspace/ui/lazy-panel';

// The lens's chips and the filtered list's empty card (Lens.tsx), from their own chunk (liveworkspace/docs/specs/
// 004-index/one-explorer.md "Cost and performance"), out of the Explorer's first load. The field (SearchField.tsx),
// the parsing and the filtering stay in it, so a lens in the address filters the list as it loads. A list fetches the
// chunk as it first draws the chips (one in the address, a list opened), and the Explorer once the page is idle
// (lazy-panes.ts), so a list opened later draws its chips in its own commit. Until then the row's place is kept.

/** The chip row's place while its code loads: its height (a row of 32 px chips with 4 px above and below, then the
 *  row's margin), so nothing under it moves when the chips draw. Nothing in it to read or focus. */
export function LensBarPlaceholder() {
  return (
    <div className="mb-3" aria-hidden="true" data-lens-placeholder="">
      <div className="h-10" />
    </div>
  );
}

const loadLens = () => import('./Lens');

export const FilteredEmpty = lazyPanel('lens-empty', () => loadLens().then((m) => m.FilteredEmpty));

export const LensBar = lazyPanel(
  'lens',
  () => {
    // The empty card comes with the chips: a lens that leaves nothing draws it in the same commit.
    void FilteredEmpty.preload();
    return loadLens().then((m) => m.LensBar);
  },
  { fallback: LensBarPlaceholder },
);
