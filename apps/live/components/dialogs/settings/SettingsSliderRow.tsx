'use client';

import { useEffect, useState } from 'react';
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsSliderRowSpec } from './settings-catalogue';

// A range setting (panel opacity). Dragging shows live feedback but only
// COMMITS on release: writeUserPreferences PUTs the whole preferences blob
// to the api, and committing per pointer-move would fire one request per
// pixel. Same split the Palette popover's opacity row already makes.
export function SettingsSliderRow({
  row,
  value,
  onCommit,
}: {
  row: SettingsSliderRowSpec;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Follow the stored value when it changes elsewhere (the Palette popover
  // sets the same preference), except while this slider is mid-drag.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <SettingsRowShell
      row={row}
      control={
        <span className="flex shrink-0 items-center gap-2">
          <input
            type="range"
            min={row.min}
            max={row.max}
            step={row.step}
            value={draft}
            aria-label={row.label}
            aria-describedby={`${row.key}-description`}
            onChange={(e) => setDraft(Number(e.target.value))}
            onPointerUp={() => onCommit(draft)}
            onKeyUp={() => onCommit(draft)}
            className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
          />
          <span className="w-9 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {row.format(draft)}
          </span>
        </span>
      }
    />
  );
}
