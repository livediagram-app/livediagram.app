'use client';

import { useEffect, useState } from 'react';

import { MAX_SIZE_PX, MIN_SIZE_PX } from '@/hooks/canvas/useShapeStyleSetters';
import { MenuActionButton } from '@/components/primitives/PortalMenu';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';

// The element menu's Size category (spec/134): the exact width and height in
// canvas pixels, the aspect-ratio lock, and the reset-to-default-proportion
// action.
//
// Its own file because it owns state — the boxes are DRAFTS while you type,
// not live-committed per keystroke. Typing "120" into a width would otherwise
// commit at "1", then "12", then "120", putting two junk sizes in the undo
// history and resizing the element twice on the way to the one you wanted.
//
// The lock and the reset used to live in Layer and Shape respectively, which
// meant the three controls that all answer "how big is this" were spread
// across two categories and one of them only appeared for morphable shapes.

/** One labelled number box. Commits on blur or Enter, reverts on Escape. */
function SizeField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  // Follow the element when it changes underneath us — a drag-resize, an undo,
  // or the aspect lock carrying this dimension after the other one was typed.
  // Skipped while focused, so a resize arriving mid-edit can't rewrite what
  // the user is halfway through typing.
  useEffect(() => {
    setDraft(String(Math.round(value)));
  }, [value]);

  const commit = () => {
    const n = Number(draft);
    // An empty or nonsense box reverts rather than resizing to zero.
    if (!Number.isFinite(n) || draft.trim() === '') {
      setDraft(String(Math.round(value)));
      return;
    }
    onCommit(n);
  };

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="relative flex items-center">
        <input
          type="number"
          inputMode="numeric"
          min={MIN_SIZE_PX}
          max={MAX_SIZE_PX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // The menu listens for keys; a number box must keep its own.
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              setDraft(String(Math.round(value)));
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs tabular-nums text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
        <span className="pointer-events-none absolute right-2 text-[10px] text-slate-400 dark:text-slate-500">
          px
        </span>
      </span>
    </label>
  );
}

export function SizeSection({
  width,
  height,
  aspectLocked,
  onSetSize,
  onToggleAspectLock,
  onResetAspectRatio,
  showReset,
}: {
  width: number;
  height: number;
  aspectLocked: boolean;
  onSetSize: (size: { width?: number; height?: number }) => void;
  onToggleAspectLock: () => void;
  onResetAspectRatio: () => void;
  // Reset-to-default-proportion only means something for a shape that HAS a
  // canonical proportion, so the button follows the same rule the Shape
  // category's morph grid does.
  showReset: boolean;
}) {
  return (
    <>
      <div className="flex items-end gap-2 px-3 py-2">
        {/* One dimension at a time, deliberately: passing only the edited key
            lets the setter carry the other one when the aspect lock is on. */}
        <SizeField label="Width" value={width} onCommit={(n) => onSetSize({ width: n })} />
        <SizeField label="Height" value={height} onCommit={(n) => onSetSize({ height: n })} />
      </div>
      <MenuToggleRow
        label="Lock aspect ratio"
        description="Typing one dimension carries the other"
        checked={aspectLocked}
        onToggle={onToggleAspectLock}
      />
      {showReset ? (
        <div className="px-2 pb-1.5 pt-0.5">
          <MenuActionButton label="Reset aspect ratio" onClick={onResetAspectRatio} />
        </div>
      ) : null}
    </>
  );
}
