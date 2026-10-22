'use client';

// A Dashboard's name in the menu box (docs/specs/026-plan/plan-tabs.md "Dashboard tab"), beside the mode menu, as a
// maximised or tab-filling board's or Sheet's rides there (menu-name-slot.tsx): the tab's name alone, no glyph.
// Someone who may edit renames the tab from the name, a button (a click, or Enter or Space on it; Enter or leaving
// saves the trimmed name, Escape puts it back, and focus returns to the name), and the tab bar follows. Nothing is
// drawn while the box has no slot (a phone).
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { Tab } from '@livepages/document';
import { IN_BOX_TITLE_CLASS, useMenuNameSlot } from '@/components/plan/menu-name-slot';

const NAME_MAX = 80;

export function DashboardMenuName({
  tab,
  onRename,
  kindLabel = 'Dashboard',
}: {
  tab: Tab;
  // What the tab is, in the rename button's name ("Rename Form Bug Report"): a Form tab names itself the same way.
  kindLabel?: string;
  // Absent for someone who may not edit.
  onRename?: ((name: string) => void) | undefined;
}) {
  const slot = useMenuNameSlot();
  const [editing, setEditing] = useState(false);
  const nameRef = useRef<HTMLButtonElement>(null);
  // Back on the name once the field closes, so the keyboard carries on from where it was.
  const refocus = useRef(false);
  useEffect(() => {
    if (editing || !refocus.current) return;
    refocus.current = false;
    nameRef.current?.focus();
  }, [editing]);
  if (!slot) return null;
  return createPortal(
    <span className="flex min-w-0 items-center">
      {editing && onRename ? (
        <NameField
          name={tab.name}
          onDone={(next) => {
            refocus.current = true;
            setEditing(false);
            if (next && next !== tab.name) onRename(next);
          }}
        />
      ) : onRename ? (
        <button
          ref={nameRef}
          type="button"
          aria-label={`Rename ${kindLabel} ${tab.name}`}
          onClick={() => setEditing(true)}
          className={`${IN_BOX_TITLE_CLASS} cursor-text rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
        >
          {tab.name}
        </button>
      ) : (
        <span className={IN_BOX_TITLE_CLASS}>{tab.name}</span>
      )}
    </span>,
    slot,
  );
}

function NameField({ name, onDone }: { name: string; onDone: (next: string | null) => void }) {
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const closed = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    onDone(save ? draft.trim() : null);
  };
  return (
    <input
      ref={input}
      aria-label="Dashboard name"
      value={draft}
      maxLength={NAME_MAX}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
      className={`${IN_BOX_TITLE_CLASS} w-40 rounded-md border border-brand-400 bg-transparent px-1.5 py-0.5 outline-none`}
    />
  );
}
