'use client';

import { Fragment, type ReactNode } from 'react';
import type { StripOpen } from './catalogue-strip-groups';
import { BrowseStartGroup } from './PaletteCategoryBrowser';

// Pieces the strip shares with its popovers (docs/specs/007-editor/toolbar-layout.md): the strip's divider, and the
// body an opener's side panel shows (CategoryFlyoutSide).

export function Divider() {
  // Hairline margins on a phone, where every pixel of the strip counts.
  return (
    <span
      aria-hidden
      className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 phone:mx-px dark:bg-slate-700"
    />
  );
}

/** An opener's body: the category it opens, or that category's catalogue group alone. */
export function StripOpenedBody({
  opened,
  content,
}: {
  opened: StripOpen;
  // The body of the category it opens (`opened.category`).
  content: ReactNode;
}) {
  return (
    <BrowseStartGroup.Provider value={opened.group ? { id: opened.group, bare: true } : null}>
      {/* Keyed on what opened it, so another opener opens the body afresh on its own. */}
      <Fragment key={opened.key}>{content}</Fragment>
    </BrowseStartGroup.Provider>
  );
}
