'use client';

// One slide's `…` menu in the Slide Deck panel (spec/31).
//
// Everything a slide can have done to it lives here: rename it, write what you
// mean to say over it, change which elements are on it, copy it, remove it.
// The row itself keeps exactly one job — pressing it opens the slide — so the
// list reads as a deck rather than as five columns of controls, and it stays
// legible in a panel the width of the palette.
//
// The same PortalMenu the Explorer's rows use, for the same reason: a menu
// hung off a row inside a scrolling panel has to escape its overflow, and the
// Explorer already solved that.

import { useRef, useState } from 'react';

import { slideName, type Slide } from '@livediagram/diagram';

import { PortalMenu } from '@/components/primitives/PortalMenu';

function Row({
  label,
  hint,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  /** Why it is unavailable, or what it will do. */
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
      className={`flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left transition disabled:cursor-default ${
        disabled
          ? 'cursor-default opacity-40'
          : danger
            ? 'cursor-pointer text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15'
            : 'cursor-pointer text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <span className="text-xs font-medium">{label}</span>
      {hint ? (
        <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">{hint}</span>
      ) : null}
    </button>
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
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A slide holds ONE tab's elements, so adding from another tab is not
  // something to refuse politely, it is something that cannot be expressed.
  const membershipHint = !onSameTab
    ? `Switch to ${'this slide’s tab'} first`
    : selectionCount === 0
      ? 'Select elements on the canvas first'
      : undefined;
  const canEditMembership = onSameTab && selectionCount > 0;

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
        <PortalMenu anchor={buttonRef.current} placement="below" onClose={() => setOpen(false)}>
          <div className="flex w-56 flex-col py-1">
            <Row
              label="Rename"
              onPress={() => {
                setOpen(false);
                onRename();
              }}
            />
            <Row
              label={slide.notes ? 'Edit presenter notes' : 'Add presenter notes'}
              hint="What you'll say over this slide"
              onPress={() => {
                setOpen(false);
                onEditNotes();
              }}
            />
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <Row
              label={
                selectionCount > 0 && onSameTab
                  ? `Add ${selectionCount === 1 ? '1 element' : `${selectionCount} elements`}`
                  : 'Add selection'
              }
              hint={membershipHint}
              disabled={!canEditMembership}
              onPress={() => {
                setOpen(false);
                onAddSelection();
              }}
            />
            <Row
              label="Remove selection"
              hint={membershipHint}
              disabled={!canEditMembership}
              onPress={() => {
                setOpen(false);
                onRemoveSelection();
              }}
            />
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <Row
              label="Duplicate"
              hint="A copy of this slide, straight after it"
              onPress={() => {
                setOpen(false);
                onDuplicate();
              }}
            />
            <Row
              label="Delete slide"
              hint={
                slide.elementIds.length === 1
                  ? 'The element stays on the canvas'
                  : 'The elements stay on the canvas'
              }
              danger
              onPress={() => {
                setOpen(false);
                onDelete();
              }}
            />
          </div>
        </PortalMenu>
      ) : null}
    </>
  );
}
