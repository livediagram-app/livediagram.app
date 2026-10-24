'use client';

import { useEffect } from 'react';
import type { SettingsSliderRow } from '../model';
import { SettingsRowShell } from '../SettingsRowShell';
import { useFollowingDraft } from '../useFollowingDraft';

// A range setting (panel opacity, UI scale). Dragging shows live feedback but only COMMITS on
// release: a write per pointer-move would be one request per pixel. The draft is this row's own
// state, so a drag re-renders this row and nothing else.
export function SettingsSliderRowView({
  row,
  disabled = false,
  notice,
}: {
  row: SettingsSliderRow;
  // A desktop-only row on a phone: greyed, takes no input, and `notice` says
  // why. The stored value is left alone for the desktop.
  disabled?: boolean;
  notice?: string;
}) {
  // Follow the stored value when it changes elsewhere (a popover sets the same preference);
  // adjusted during render.
  const [draft, setDraft] = useFollowingDraft(row.value);
  // A row with a live preview (UI scale) shows the value under the thumb as it
  // moves; the release commits it and ends the preview. Closing the dialog
  // mid-drag ends it too, so an uncommitted value never sticks.
  const { preview } = row;
  useEffect(() => () => preview?.(null), [preview]);
  const commit = () => {
    row.onCommit(draft);
    preview?.(null);
  };

  return (
    <SettingsRowShell
      row={row}
      notice={notice}
      dimmed={disabled}
      control={
        <span className="flex shrink-0 items-center gap-2">
          <input
            type="range"
            min={row.min}
            max={row.max}
            step={row.step}
            value={draft}
            disabled={disabled}
            aria-label={row.label}
            aria-describedby={`${row.key}-description`}
            onChange={(e) => {
              const next = Number(e.target.value);
              setDraft(next);
              preview?.(next);
            }}
            onPointerUp={commit}
            onKeyUp={commit}
            className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700"
          />
          <span className="w-9 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {row.format(draft)}
          </span>
        </span>
      }
    />
  );
}
