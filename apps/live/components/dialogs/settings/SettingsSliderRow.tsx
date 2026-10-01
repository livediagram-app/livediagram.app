'use client';

import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsSliderRowSpec } from './settings-catalogue';
import { useFollowingDraft } from '@/hooks/ui/useFollowingDraft';

// A range setting (panel opacity, UI scale). Dragging shows live feedback but only
// COMMITS on release: writeUserPreferences PUTs the whole preferences blob
// to the api, and committing per pointer-move would fire one request per
// pixel. Same split the Palette popover's opacity row already makes.
export function SettingsSliderRow({
  row,
  value,
  onCommit,
  disabled = false,
  notice,
}: {
  row: SettingsSliderRowSpec;
  value: number;
  onCommit: (next: number) => void;
  // A desktop-only row on a phone: greyed, takes no input, and `notice` says
  // why. The stored value is left alone for the desktop.
  disabled?: boolean;
  notice?: string;
}) {
  // Follow the stored value when it changes elsewhere (the Palette popover
  // sets the same preference); adjusted during render.
  const [draft, setDraft] = useFollowingDraft(value);

  return (
    <SettingsRowShell
      row={row}
      notice={notice}
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
            onChange={(e) => setDraft(Number(e.target.value))}
            onPointerUp={() => onCommit(draft)}
            onKeyUp={() => onCommit(draft)}
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
