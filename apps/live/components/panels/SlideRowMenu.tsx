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
  MenuTile,
  MenuTileGrid,
  MenuToolbar,
  MenuToolButton,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import { DuplicateIcon, PencilIcon, TrashIcon } from '@/components/panels/explorer-icons';
import { EyeIcon, EyeOffIcon } from '@/components/panels/layers-panel-icons';
import { NoteMenuIcon } from '@/components/palette/context-menu-icons';

function SelectionIcon() {
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
  onToggleHidden,
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
  onToggleHidden: () => void;
  onDuplicate: () => void;
  onDelete: (anchor: HTMLElement | null) => void;
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
    ? 'Switch to this slide’s own tab to change what is on it.'
    : 'Select elements on the canvas to add them to this slide.';

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
                  // Hand the menu button up as the anchor so the panel can
                  // open the confirm beside it — the same pattern the
                  // Explorer's row menu uses for its own Delete.
                  onDelete(buttonRef.current);
                  close();
                }}
              />
            </div>
          </MenuToolbar>
          {/* No MenuGroupSeparator here: MenuAccordionSection draws its own
              top hairline, and the two together read as a double rule. */}
          <MenuAccordionSection
            title="Selection"
            icon={<SelectionIcon />}
            open={section === 'selection'}
            onToggle={() => setSection((s) => (s === 'selection' ? null : 'selection'))}
          >
            <div className="px-2 py-1.5">
              {/* What the two buttons DO, above them rather than under: a pair
                  of bare verbs called Add and Remove says nothing about what
                  they act on, and by the time you have read the caption
                  underneath you have already had to guess. */}
              <p className="px-1 pb-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                {canEditMembership
                  ? `Put what you have selected on this slide, or take it off. It holds ${
                      slide.elementIds.length === 1
                        ? '1 element'
                        : `${slide.elementIds.length} elements`
                    } now.`
                  : membershipWhy}
              </p>
              <MenuTileGrid cols={2}>
                <MenuTile
                  icon={<PlusIcon />}
                  label={canEditMembership && selectionCount > 1 ? `Add ${selectionCount}` : 'Add'}
                  disabled={!canEditMembership}
                  onClick={() => {
                    close();
                    onAddSelection();
                  }}
                />
                <MenuTile
                  icon={<MinusIcon />}
                  label="Remove"
                  disabled={!canEditMembership}
                  onClick={() => {
                    close();
                    onRemoveSelection();
                  }}
                />
              </MenuTileGrid>
            </div>
          </MenuAccordionSection>
          <MenuAccordionSection
            title="Visibility"
            icon={slide.hidden ? <EyeOffIcon /> : <EyeIcon />}
            open={section === 'visibility'}
            onToggle={() => setSection((s) => (s === 'visibility' ? null : 'visibility'))}
          >
            <div className="px-2 py-1.5">
              {/* Hiding is a different idea from deleting, and the panel should
                  say so: a slide you might want next week, a backup detail for
                  a question you may not get, a section you cut for time. */}
              <p className="px-1 pb-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                {slide.hidden
                  ? 'This slide is skipped when you present. It still lives in the deck.'
                  : 'Keep the slide, leave it out of the run. Nothing is deleted.'}
              </p>
              <MenuTileGrid cols={2}>
                <MenuTile
                  icon={slide.hidden ? <EyeIcon /> : <EyeOffIcon />}
                  label={slide.hidden ? 'Show' : 'Hide'}
                  active={slide.hidden}
                  onClick={() => {
                    close();
                    onToggleHidden();
                  }}
                />
              </MenuTileGrid>
            </div>
          </MenuAccordionSection>
        </PortalMenu>
      ) : null}
    </>
  );
}
