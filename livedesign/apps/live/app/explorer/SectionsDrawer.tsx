'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon, useFocusTrap } from '@livepages/ui';

// The Explorer's sections on a phone (docs/specs/013-workspace/explorer-structure.md): the sidebar is hidden below
// `sm`, so this slides the same tree in from the left, opened by the hamburger in the pane header or the Home hero.
// A modal like any other: focus moves in and comes back, Tab stays inside, and Escape or the backdrop closes it.
export function SectionsDrawer({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] sm:hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sections"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-slide-in-left flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="mb-1 flex items-center justify-between pl-1">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sections</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={11} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
