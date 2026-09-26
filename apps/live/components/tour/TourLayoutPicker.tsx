'use client';

import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { choiceRow, choiceTelemetryType } from '@/components/dialogs/settings/settings-catalogue';
import { CHOICE_ILLUSTRATIONS } from '@/components/dialogs/settings/settings-choice-illustrations';
import { H, StateFrame, W } from '@/components/dialogs/settings/settings-illustration-kit';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { track } from '@/lib/telemetry';

// The Settings row this picker mirrors (docs/specs/007-editor/toolbar-layout.md): its options, which of
// them a phone can't use, how it reads and writes the preference, and its
// telemetry token all come from the row, so the two surfaces can't disagree.
const ROW = choiceRow('panelLayout');

// The welcome card's panel-layout choice (docs/specs/007-editor/editor-tour.md): the Settings row's three
// layout drawings, one button each, the one in force ringed. Picking applies
// at once, so the editor behind the card changes as you click and the tour
// that follows points at the chrome you chose.
export function TourLayoutPicker() {
  const ctx = useEditorContext();
  const mobile = useIsMobileViewport();
  const prefs = ctx.userPreferences ?? {};
  const drawings = CHOICE_ILLUSTRATIONS.panelLayout.states;
  // A phone only offers what it can use: Floating is desktop only, so it
  // isn't shown there, and a stored Floating rings Toolbar, which is what
  // the phone shows instead (docs/specs/007-editor/toolbar-layout.md).
  const options = mobile ? ROW.options.filter((o) => !o.desktopOnly) : ROW.options;
  const value = ROW.read(prefs, { mobile });

  const pick = (id: string) => {
    // Fired before the write, like every settings flip (docs/specs/017-telemetry/telemetry.md).
    track(ROW.event.category, 'Changed', choiceTelemetryType(ROW.event.changed, id));
    const next = ROW.write(prefs, id);
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
  };

  return (
    // Boxed like the welcome art above it, so the choice reads as its own
    // panel rather than more of the card's copy.
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
        Choose Your Layout
      </span>
      {/* Each option takes a third of the row, so two on a phone stay the
          same size as three on desktop, centred. */}
      <div role="radiogroup" aria-label="Panel layout" className="flex justify-center gap-1.5">
        {options.map((option) => {
          const drawing = drawings.find((d) => d.id === option.id);
          const current = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={current}
              aria-label={option.label}
              onClick={() => {
                if (!current) pick(option.id);
              }}
              className="min-w-0 max-w-[calc((100%-0.75rem)/3)] flex-1 rounded-md p-0.5 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-900"
            >
              <svg
                viewBox={`-4 -4 ${W + 8} ${H + 22}`}
                className="h-auto w-full"
                fill="none"
                aria-hidden
              >
                {drawing ? (
                  <StateFrame art={drawing.art} caption={option.label} current={current} />
                ) : null}
              </svg>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
        You can change this any time in Settings.
      </p>
    </div>
  );
}
