'use client';

// The presenter's settings, opened from the cog in the HUD (docs/specs/012-collaboration/presentation-mode.md
// "Settings"): only what is changed in front of the room, Transition and Speed, then the two pacing clocks. Every
// other presenter setting is set before the talk, in Settings > Presenting. This popover opens ON a projector, so
// everything here is a segmented control or a switch, decided in one glance and undone in one more.
//
// The person's own (lib/presentation-config), following their account, not a property of the document.

import { HoverCard, SwitchRow } from '@livehuddle/ui';
import {
  SLIDE_SPEEDS,
  SLIDE_TRANSITIONS,
  type PresentationConfig,
} from '@/lib/presentation-config';

/** A labelled band of settings. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <span className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
        {title}
      </span>
      {children}
    </>
  );
}

/** A row of mutually-exclusive choices. */
function Segmented<T extends string | number>({
  options,
  value,
  onPick,
}: {
  options: readonly { id: T; label: string; hint?: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 px-1">
      {options.map((o) => (
        <HoverCard key={String(o.id)} title={o.label} description={o.hint} className="flex-1">
          <button
            type="button"
            aria-pressed={value === o.id}
            onClick={(e) => {
              e.stopPropagation();
              onPick(o.id);
            }}
            className={`flex-1 cursor-pointer rounded-md px-1.5 py-1 text-[11px] font-medium transition ${
              value === o.id
                ? 'bg-white/25 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white/90'
            }`}
          >
            {o.label}
          </button>
        </HoverCard>
      ))}
    </div>
  );
}

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
    // The small track sits first, on a dark panel: brand-400 on, a quarter-white off.
    <SwitchRow
      checked={on}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      size="xs"
      track="start"
      onColor="var(--color-brand-400)"
      offColor="rgb(255 255 255 / 0.25)"
      layout="flex w-full items-start gap-2 rounded-md text-left"
      className="px-2 py-1.5 transition hover:bg-white/10 [&>[data-switch]]:mt-0.5"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-medium text-white/90">{label}</span>
        <span className="text-[10px] leading-tight text-white/45">{hint}</span>
      </span>
    </SwitchRow>
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
      className="pointer-events-auto fixed right-4 top-16 z-[66] flex max-h-[75vh] w-64 flex-col gap-1 overflow-y-auto rounded-xl bg-slate-900/90 p-2 shadow-2xl backdrop-blur"
    >
      <Group title="Transition">
        <Segmented
          options={SLIDE_TRANSITIONS}
          value={config.transition}
          onPick={(id) => onChange({ transition: id })}
        />
        {/* Speed is meaningless without a transition, so it goes away with it
            rather than sitting there greyed out. */}
        {config.transition !== 'none' ? (
          <Segmented
            options={SLIDE_SPEEDS}
            value={config.speed}
            onPick={(id) => onChange({ speed: id })}
          />
        ) : null}
      </Group>

      <div className="my-1 border-t border-white/10" />

      {/* The clocks: pacing is read in front of the room, so it is switched there too. */}
      <Group title="Pacing">
        <Toggle
          label="Show Elapsed Time"
          hint="A clock counting from the moment you started"
          on={config.showElapsed}
          onChange={(next) => onChange({ showElapsed: next })}
        />
        <Toggle
          label="Show Slide Budget"
          hint="Time on this slide against the minutes it was given"
          on={config.showBudget}
          onChange={(next) => onChange({ showBudget: next })}
        />
      </Group>

      {/* Everything else is set before the talk (docs/specs/012-collaboration/presentation-mode.md "Settings"). */}
      <p className="px-2 pb-1 pt-2 text-[11px] leading-snug text-white/60">
        Playback, slide size and what shows while presenting are in Settings, under Presenting.
      </p>
    </div>
  );
}
