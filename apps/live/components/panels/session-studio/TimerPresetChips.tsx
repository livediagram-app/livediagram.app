'use client';

// The timer's length presets as a row of chips, shared by the Session Studio's
// Timer pane and the Session button's `…` quick settings (docs/specs/012-collaboration/session-tools.md, docs/specs/012-collaboration/session-button.md).
//
// The `…` menu used to list every preset as its own row — eight of them, "1
// minute" through "30 minutes", a column taller than the element it belonged
// to. The Studio had already answered the same question in one line of chips,
// so the menu now uses that instead: the same six lengths, the same look, and
// a popover that fits beside the button rather than running past it.
//
// Six presets, not the eight the rows carried. A quick setting is for the
// length you reach for, and the Studio's list is the one that was chosen for
// that; anything else is a number field away in All settings.

const PRESETS = [1, 3, 5, 10, 15, 30] as const;

export function TimerPresetChips({
  minutes,
  onPick,
}: {
  minutes: number;
  onPick: (minutes: number) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1" role="group" aria-label="Preset lengths">
      {PRESETS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onPick(m)}
          aria-pressed={minutes === m}
          className={`cursor-pointer rounded-md py-1 text-[11px] font-semibold tabular-nums transition ${
            minutes === m
              ? 'bg-brand-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-brand-500/15'
          }`}
        >
          {m}m
        </button>
      ))}
    </div>
  );
}
