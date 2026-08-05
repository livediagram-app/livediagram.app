'use client';

// The presenter's settings, opened from the cog in the HUD (spec/31).
//
// Grouped into Transition, Playback and Display, because the list grew past
// the point where a flat one reads as a list. Each entry still has to be a
// decision the presenter can make in one glance and undo in one more — this
// popover opens ON a projector, in front of a room — so everything here is a
// segmented control or a switch, and nothing needs typing or dragging.
//
// Device-local (lib/presentation-config): how YOU drive a deck on THIS
// machine, not a property of the diagram.

import {
  AUTO_ADVANCE_CHOICES,
  SLIDE_SPEEDS,
  SLIDE_TRANSITIONS,
  SLIDE_ZOOMS,
  type PresentationConfig,
} from '@/lib/presentation-config';

/** A labelled band of settings. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <span className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
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
        <button
          key={String(o.id)}
          type="button"
          title={o.hint}
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

      <Group title="Playback">
        {/* Auto-advance pairs with Loop: together they are the whole
            "leave it running on the wall" setup. */}
        <Segmented
          options={AUTO_ADVANCE_CHOICES.map((c) => ({
            id: c.seconds,
            label: c.label,
            hint: c.seconds === 0 ? 'Only move when you say so' : `Advance every ${c.seconds}s`,
          }))}
          value={config.autoAdvanceSeconds}
          onPick={(seconds) => onChange({ autoAdvanceSeconds: seconds })}
        />
        <Toggle
          label="Click to advance"
          hint="Off if you'd rather only the keys and buttons move the deck"
          on={config.advanceOnClick}
          onChange={(next) => onChange({ advanceOnClick: next })}
        />
        <Toggle
          label="Loop the deck"
          hint="After the last slide, start again rather than ending"
          on={config.loop}
          onChange={(next) => onChange({ loop: next })}
        />
      </Group>

      <div className="my-1 border-t border-white/10" />

      <Group title="Display">
        <Segmented
          options={SLIDE_ZOOMS}
          value={config.zoom}
          onPick={(id) => onChange({ zoom: id })}
        />
        <Toggle
          label="Show position"
          hint="The 7 / 23 counter and the slide's name"
          on={config.showPosition}
          onChange={(next) => onChange({ showPosition: next })}
        />
        <Toggle
          label="Keep controls visible"
          hint="Stop them fading out when the pointer rests"
          on={config.keepControls}
          onChange={(next) => onChange({ keepControls: next })}
        />
        <Toggle
          label="Hide the pointer"
          hint="A still cursor left on a projector is a distraction"
          on={config.hidePointer}
          onChange={(next) => onChange({ hidePointer: next })}
        />
        <Toggle
          label="Show elapsed time"
          hint="A clock counting from the moment you started"
          on={config.showElapsed}
          onChange={(next) => onChange({ showElapsed: next })}
        />
        <Toggle
          label="Show slide budget"
          hint="Time on this slide against the minutes it was given"
          on={config.showBudget}
          onChange={(next) => onChange({ showBudget: next })}
        />
      </Group>
    </div>
  );
}
