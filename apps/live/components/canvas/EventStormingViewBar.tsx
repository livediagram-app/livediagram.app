'use client';

import { EVENT_STORMING_STAGES, type EventStormingStage } from '@livediagram/diagram';

// The event-storming workshop-view switcher (spec/139): a slim floating
// pill in the bottom-centre slot, shown only on event-storming boards
// (tabs shipping the ES stage layers) for editors. Three EXCLUSIVE stage
// chips — Big picture / Process / Design — reveal the workshop's layers
// cumulatively, plus an independent Timeline-rail toggle that shows the
// board against the hidden spec/51 rail scaffold.
//
// The chips drive SHARED layer visibility (one ordinary tab commit), so
// the whole room moves through the stages together, facilitator-style —
// which is why the pressed state reads from props (the room's tab data)
// rather than any local state. The host (EditorView) owns visibility and
// keeps this out of zen / embed / read-only sessions and out of the
// banners' way.

export function EventStormingViewBar({
  stage,
  railVisible,
  onStage,
  onToggleRail,
}: {
  stage: EventStormingStage;
  railVisible: boolean;
  onStage: (stage: EventStormingStage) => void;
  onToggleRail: () => void;
}) {
  const chip = (pressed: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
      pressed
        ? 'bg-brand-500 text-white shadow-sm'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'
    }`;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-overlay)] flex justify-center px-4 pb-16">
      <div
        role="group"
        aria-label="Event storming view"
        className="pointer-events-auto flex animate-fly-up-in items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
      >
        {EVENT_STORMING_STAGES.map((s) => (
          <button
            key={s.stage}
            type="button"
            aria-pressed={stage === s.stage}
            className={chip(stage === s.stage)}
            onClick={() => {
              if (s.stage !== stage) onStage(s.stage);
            }}
          >
            {s.label}
          </button>
        ))}
        <span aria-hidden className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        {/* The rail is additive — "see it against a timeline" — so it is a
            toggle beside the stages, never a fourth exclusive stage. */}
        <button
          type="button"
          aria-pressed={railVisible}
          className={chip(railVisible)}
          onClick={onToggleRail}
        >
          Timeline rail
        </button>
      </div>
    </div>
  );
}
