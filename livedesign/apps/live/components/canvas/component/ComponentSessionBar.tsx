'use client';

// The edit session's bar (docs/specs/009-elements/components.md "Editing the main: the edit session"): over the canvas
// while this person edits a main in place, naming it and how many places use it, with Done. Escape with nothing
// selected is Done too.
import { useEffect } from 'react';
import { lucideCheck, lucidePackage } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';

const ComponentIcon = lucideGlyph(lucidePackage, 16);
const DoneIcon = lucideGlyph(lucideCheck, 16);

export function ComponentSessionBar({
  name,
  nothingSelected,
  onDone,
}: {
  name: string;
  // Read as Escape lands: a selection takes the first Escape (it clears it).
  nothingSelected: () => boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !nothingSelected()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      onDone();
    };
    // Captured, so the selection is read before the editor's own Escape clears it.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [nothingSelected, onDone]);
  return (
    <div
      role="status"
      data-component-session-bar=""
      className="pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full border border-brand-200 bg-white py-1 pl-3 pr-1 text-sm shadow-md dark:border-brand-800 dark:bg-slate-900"
    >
      <span className="text-brand-700 dark:text-brand-300">
        <ComponentIcon />
      </span>
      <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
        Editing <span className="font-semibold">{name}</span>
        <span className="hidden text-slate-500 sm:inline"> · changes reach every instance</span>
      </span>
      <Tooltip label="Finish editing the component (Escape)">
        <button
          type="button"
          data-component-done=""
          onClick={onDone}
          className="flex cursor-pointer items-center gap-1 rounded-full bg-brand-700 px-3 py-1 text-sm font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          <DoneIcon />
          Done
        </button>
      </Tooltip>
    </div>
  );
}
