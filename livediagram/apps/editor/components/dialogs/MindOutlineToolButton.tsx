'use client';

// A button on Edit Outline's toolbar (docs/specs/009-elements/mind-node.md "Edit Outline"): an icon
// with a hover card naming its key, acting on the row or line being edited without taking the
// focus from it.
import type { ReactNode } from 'react';
import { HoverCard } from '@livediagram/ui';
import { TOOLBAR_CONTROL_REST } from '@/components/chrome/toolbar-surface';

export function MindOutlineToolButton({
  label,
  shortcut,
  disabled = false,
  pressed,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  disabled?: boolean;
  // Set for a toggle (Bold): whether it is on for the selection.
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <HoverCard title={label} description={`Shortcut: ${shortcut}.`}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        // The caret stays where it is: the button acts on it.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent ${
          pressed
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : TOOLBAR_CONTROL_REST
        }`}
      >
        {children}
      </button>
    </HoverCard>
  );
}

export function MindOutlineToolDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />;
}
