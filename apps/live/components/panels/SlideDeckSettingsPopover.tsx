'use client';

import { SettingsPopover, SettingsPopoverResetRow } from '@/components/primitives/SettingsPopover';
import { SettingsToggleRow } from '@/components/panels/SettingsToggleRow';
import {
  AUTO_ADVANCE_CHOICES,
  SLIDE_SPEEDS,
  SLIDE_TRANSITIONS,
  SLIDE_ZOOMS,
  type PresentationConfig,
} from '@/lib/presentation-config';

// Settings for the Slide Deck panel (spec/31): the SAME presenter settings the
// cog in the HUD carries, reachable before you start rather than only once you
// are already in front of the room.
//
// That is the whole reason this exists. Discovering "Actual size" or "Auto
// advance" mid-presentation means changing it while people watch; the point of
// a rehearsal is that you arrive with it already set. Same state, same
// localStorage, two doors — so whichever one you find, the other agrees.
//
// It wears the panel's own furniture (the shared SettingsPopover shell the
// Palette, Map and Layers gears use) rather than the HUD's dark card, because
// a popover in a light panel that looked like the projector overlay would read
// as a stray piece of another screen.

/** A labelled row of mutually-exclusive choices, panel-toned. */
function ChoiceRow<T extends string | number>({
  label,
  hint,
  options,
  value,
  onPick,
}: {
  label: string;
  hint?: string;
  options: readonly { id: T; label: string; hint?: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-2 py-1.5">
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {hint ? (
        <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">{hint}</span>
      ) : null}
      <div className="flex gap-1 pt-0.5">
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            title={o.hint}
            aria-pressed={value === o.id}
            onClick={() => onPick(o.id)}
            className={`flex-1 cursor-pointer rounded-md border px-1 py-1 text-[10px] font-medium transition ${
              value === o.id
                ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-200'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SlideDeckSettingsPopover({
  config,
  onChange,
  onResetPosition,
  resettable,
}: {
  config: PresentationConfig;
  onChange: (patch: Partial<PresentationConfig>) => void;
  onResetPosition: () => void;
  resettable: boolean;
}) {
  return (
    <SettingsPopover
      label="Presentation"
      description="How the deck behaves when you present it."
      triggerAttr="data-slide-deck-settings-trigger"
      width={248}
    >
      {(close) => (
        <>
          <ChoiceRow
            label="Transition"
            options={SLIDE_TRANSITIONS}
            value={config.transition}
            onPick={(id) => onChange({ transition: id })}
          />
          {/* Speed is meaningless without a transition, so it goes away with
              it rather than sitting there greyed out. */}
          {config.transition !== 'none' ? (
            <ChoiceRow
              label="Speed"
              options={SLIDE_SPEEDS}
              value={config.speed}
              onPick={(id) => onChange({ speed: id })}
            />
          ) : null}
          <ChoiceRow
            label="Auto-advance"
            hint="Move on by itself. With Loop, this runs a deck unattended."
            options={AUTO_ADVANCE_CHOICES.map((c) => ({ id: c.seconds, label: c.label }))}
            value={config.autoAdvanceSeconds}
            onPick={(seconds) => onChange({ autoAdvanceSeconds: seconds })}
          />
          <ChoiceRow
            label="Slide size"
            options={SLIDE_ZOOMS}
            value={config.zoom}
            onPick={(id) => onChange({ zoom: id })}
          />
          <SettingsToggleRow
            checked={config.advanceOnClick}
            onToggle={() => onChange({ advanceOnClick: !config.advanceOnClick })}
            label="Click to advance"
            hint="Off if you'd rather only the keys and buttons move the deck."
          />
          <SettingsToggleRow
            checked={config.loop}
            onToggle={() => onChange({ loop: !config.loop })}
            label="Loop the deck"
            hint="After the last slide, start again rather than ending."
          />
          <SettingsToggleRow
            checked={config.showPosition}
            onToggle={() => onChange({ showPosition: !config.showPosition })}
            label="Show position"
            hint="The 7 / 23 counter and the slide's name, while presenting."
          />
          <SettingsToggleRow
            checked={config.keepControls}
            onToggle={() => onChange({ keepControls: !config.keepControls })}
            label="Keep controls visible"
            hint="Stop them fading out when the pointer rests."
          />
          <SettingsToggleRow
            checked={config.hidePointer}
            onToggle={() => onChange({ hidePointer: !config.hidePointer })}
            label="Hide the pointer"
            hint="A still cursor left on a projector is a distraction."
          />
          <SettingsPopoverResetRow
            onReset={onResetPosition}
            resettable={resettable}
            onClose={close}
          />
        </>
      )}
    </SettingsPopover>
  );
}
