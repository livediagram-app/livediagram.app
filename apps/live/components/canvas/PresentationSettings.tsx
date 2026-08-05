'use client';

// The presenter's settings, opened from the cog in the HUD (spec/31).
//
// Deliberately four things and no more. This popover opens ON a projector, in
// front of a room, usually because something is not behaving the way the
// presenter wants right now — so every entry has to be a decision they can
// make in one glance and undo in one more. Anything that needs thinking about
// belongs in the panel, before you start.
//
// Device-local (lib/presentation-config): how YOU drive a deck on THIS
// machine, not a property of the diagram.

import {
  SLIDE_TRANSITIONS,
  type PresentationConfig,
  type SlideTransition,
} from '@/lib/presentation-config';

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white/10"
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-3.5 w-6 shrink-0 items-center rounded-full transition ${
          on ? 'bg-brand-400' : 'bg-white/25'
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${
            on ? 'translate-x-3' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-medium text-white/90">{label}</span>
        <span className="text-[10px] leading-tight text-white/45">{hint}</span>
      </span>
    </button>
  );
}

export function PresentationSettings({
  config,
  onChange,
}: {
  config: PresentationConfig;
  onChange: (patch: Partial<PresentationConfig>) => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Presentation settings"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed right-4 top-16 z-[66] flex w-64 flex-col gap-1 rounded-xl bg-slate-900/90 p-2 shadow-2xl backdrop-blur"
    >
      <span className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
        Transition
      </span>
      <div className="flex gap-1 px-1">
        {SLIDE_TRANSITIONS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            aria-pressed={config.transition === t.id}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ transition: t.id as SlideTransition });
            }}
            className={`flex-1 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium transition ${
              config.transition === t.id
                ? 'bg-white/25 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white/90'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="my-1 border-t border-white/10" />

      <Toggle
        label="Click to advance"
        hint="Off if you'd rather only the keys and arrows move the deck"
        on={config.advanceOnClick}
        onChange={(next) => onChange({ advanceOnClick: next })}
      />
      <Toggle
        label="Loop the deck"
        hint="After the last slide, start again rather than ending"
        on={config.loop}
        onChange={(next) => onChange({ loop: next })}
      />
      <Toggle
        label="Show position"
        hint="The 7 / 23 counter and the slide's name"
        on={config.showPosition}
        onChange={(next) => onChange({ showPosition: next })}
      />
    </div>
  );
}
