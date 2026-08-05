'use client';

// One slide's `…` menu in the Slide Deck panel (spec/31).
//
// Everything a slide can have done to it lives here, so the row itself keeps
// exactly one job — pressing it opens the slide — and the list reads as a deck
// rather than as five columns of controls in a panel the width of the palette.
//
// Built from the shared menu furniture the Explorer's rows and the tab context
// menu use, in the same shape: a compact icon TOOLBAR of the verbs reached for
// most often (rename, notes, duplicate, with delete pinned to the right edge),
// a separator, then the verbose actions in a labelled accordion section of
// tiles. A menu that looked like this one used to and nothing else in the app
// is a menu people have to learn twice.

import { useRef, useState } from 'react';

import { slideName, type Slide } from '@livediagram/diagram';

import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
  MenuToolbar,
  MenuToolButton,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import { DuplicateIcon, PencilIcon, TrashIcon } from '@/components/panels/explorer-icons';
import { NoteMenuIcon } from '@/components/palette/context-menu-icons';

function ElementsIcon() {
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
      <rect x="1.8" y="1.8" width="5.5" height="5.5" rx="1" />
      <rect x="8.7" y="8.7" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 8h9" />
    </svg>
  );
}

export function SlideRowMenu({
  slide,
  index,
  onSameTab,
  selectionCount,
  onRename,
  onEditNotes,
  onAddSelection,
  onRemoveSelection,
  onDuplicate,
  onDelete,
}: {
  slide: Slide;
  index: number;
  /** Is the editor on this slide's own tab? Membership edits need it. */
  onSameTab: boolean;
  selectionCount: number;
  onRename: () => void;
  onEditNotes: () => void;
  onAddSelection: () => void;
  onRemoveSelection: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    setSection(null);
  };

  // A slide holds ONE tab's elements, so adding from another tab is not
  // something to refuse politely, it is something that cannot be expressed.
  const canEditMembership = onSameTab && selectionCount > 0;
  const membershipWhy = !onSameTab
    ? 'Switch to this slide’s tab first.'
    : 'Select elements on the canvas first.';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Options for ${slideName(slide, index)}`}
        aria-expanded={open}
        // The row is draggable and pressable; neither should fire because the
        // pointer went down on this button.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="3" cy="7" r="1.25" fill="currentColor" />
          <circle cx="7" cy="7" r="1.25" fill="currentColor" />
          <circle cx="11" cy="7" r="1.25" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <PortalMenu anchor={buttonRef.current} placement="below" onClose={close}>
          {/* Quick-action toolbar, matching the Explorer's rows and the tab
              context menu: the verbs reached for most often as a compact icon
              row, Delete pinned to the right edge. */}
          <MenuToolbar>
            <MenuToolButton
              icon={<PencilIcon />}
              label="Rename"
              description="Rename this slide."
              onClick={() => {
                close();
                onRename();
              }}
            />
            <MenuToolButton
              icon={<NoteMenuIcon />}
              label={slide.notes ? 'Edit notes' : 'Add notes'}
              description="What you'll say over this slide."
              active={!!slide.notes}
              onClick={() => {
                close();
                onEditNotes();
              }}
            />
            <MenuToolButton
              icon={<DuplicateIcon />}
              label="Duplicate"
              description="A copy of this slide, straight after it."
              onClick={() => {
                close();
                onDuplicate();
              }}
            />
            <div className="ml-auto">
              <MenuToolButton
                icon={<TrashIcon />}
                label="Delete"
                description={
                  slide.elementIds.length === 1
                    ? 'Remove this slide from the deck. The element stays on the canvas.'
                    : 'Remove this slide from the deck. The elements stay on the canvas.'
                }
                danger
                onClick={() => {
                  close();
                  onDelete();
                }}
              />
            </div>
          </MenuToolbar>
          <MenuGroupSeparator />
          <MenuAccordionSection
            title="Elements"
            icon={<ElementsIcon />}
            open={section === 'elements'}
            onToggle={() => setSection((s) => (s === 'elements' ? null : 'elements'))}
          >
            <div className="px-2 py-1.5">
              <MenuTileGrid cols={2}>
                <MenuTile
                  icon={<PlusIcon />}
                  label={
                    canEditMembership && selectionCount > 1
                      ? `Add ${selectionCount}`
                      : 'Add selection'
                  }
                  disabled={!canEditMembership}
                  onClick={() => {
                    close();
                    onAddSelection();
                  }}
                />
                <MenuTile
                  icon={<MinusIcon />}
                  label="Remove selection"
                  disabled={!canEditMembership}
                  onClick={() => {
                    close();
                    onRemoveSelection();
                  }}
                />
              </MenuTileGrid>
              <p className="px-1 pt-1.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                {canEditMembership
                  ? `This slide holds ${
                      slide.elementIds.length === 1
                        ? '1 element'
                        : `${slide.elementIds.length} elements`
                    }.`
                  : membershipWhy}
              </p>
            </div>
          </MenuAccordionSection>
        </PortalMenu>
      ) : null}
    </>
  );
}
