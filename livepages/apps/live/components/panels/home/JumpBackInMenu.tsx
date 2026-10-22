'use client';

// The ⋯ menu a Jump Back In card or tile carries (docs/specs/013-workspace/explorer-home.md "Jump Back In"): the
// document's own Explorer menu (DocumentEntryMenu), from a ⋯ button that sits beside the card's link (a button can't
// sit inside one) or a right-click anywhere on the card. Without an entry (a document the Explorer has not loaded)
// it draws only its children: no button, and the browser's own right-click. The menu opens beside the card, out of its
// way, when there is room.

import { useState, type ReactNode } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { DocumentEntryMenu } from '@/app/explorer/document-row-shared';
import type { DocumentEntryProps } from '@/app/explorer/explorer-view-props';

/** Resolves a Jump Back In document to its Explorer menu, or null when the Explorer has not loaded it. */
export type JumpBackInMenuFor = (documentId: string) => DocumentEntryProps | null;

// Readable over a thumbnail: a frosted chip rather than the row button's bare glyph. Shown while the card is hovered
// or holds keyboard focus (the reveal covers hover and the button's own focus; focus-within covers the card's link).
// `!absolute`: the shared button carries `relative` (its touch target), which would otherwise win.
const BUTTON_CHIP =
  '!absolute bg-white/90 shadow-sm ring-1 ring-slate-200 pointer-fine:group-focus-within:opacity-100 dark:bg-slate-900/90 dark:ring-slate-700';

export function JumpBackInMenu({
  entry,
  name,
  buttonClassName,
  className,
  children,
}: {
  entry: DocumentEntryProps | null;
  /** The document's name as shown, for the button's label. */
  name: string;
  /** Where the button sits on this card. */
  buttonClassName: string;
  className?: string;
  children: ReactNode;
}) {
  const menu = useRowMenu({ disabled: !entry || entry.renaming });
  // The card itself, for the menu to open beside.
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setCard}
      className={`group relative min-w-0 ${className ?? ''}`}
      onContextMenu={entry ? menu.onContextMenu : undefined}
    >
      {children}
      {entry && !entry.renaming ? (
        <EllipsisTriggerButton
          {...menu.triggerProps}
          reveal
          label={`Menu for ${name}`}
          className={`${BUTTON_CHIP} ${buttonClassName}`}
        />
      ) : null}
      {entry && menu.open ? (
        <DocumentEntryMenu
          entry={entry}
          anchor={menu.triggerRef.current}
          beside={card}
          onClose={menu.close}
        />
      ) : null}
    </div>
  );
}

/** The name, editable in place while the menu's Rename is under way. */
export function JumpBackInRename({
  entry,
  className,
}: {
  entry: DocumentEntryProps;
  className: string;
}) {
  return (
    <InlineRenameInput
      initial={entry.document.name}
      ariaLabel={`Rename ${entry.document.name}`}
      onCommit={entry.onCommitRename}
      onCancel={entry.onCancelRename}
      className={className}
    />
  );
}
