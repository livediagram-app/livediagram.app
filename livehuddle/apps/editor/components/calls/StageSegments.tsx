'use client';

// The call strip's stage pieces (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand", "The stage
// line", "Do Not Disturb"): Raise Hand / Lower Hand for a live stage's audience, Speaking once let speak, the count of
// raised hands for whoever speaks from a stage, the Do Not Disturb segment that clears the status, and the calm line
// above the strip on a stage you may not speak from.
import { lucideHand, lucideMic } from '@liveworkspace/icons/lucide';
import type { IconPrim } from '@liveworkspace/icons';
import { lucideGlyph } from '@livehuddle/ui';
import type { CallActions, CallSelf } from '@/lib/calls/calls-store';
import { Segment } from './CallSegment';

const HandIcon = lucideGlyph(lucideHand, 16);
const MicIcon = lucideGlyph(lucideMic, 16);
// Do Not Disturb's own sign, the status dot's shape in the strip's line weight: a circle with a bar across.
const DND_ART: readonly IconPrim[] = [
  { t: 'circle', cx: 12, cy: 12, r: 10 },
  { t: 'path', d: 'M8 12h8' },
];
const DndIcon = lucideGlyph(DND_ART, 16);

/** The stage line's words for a stage's Who Can Speak. */
export const STAGE_LINE: Record<'edit' | 'take-part', string> = {
  edit: 'Only Editors speak from this stage',
  'take-part': 'Only Editors and Participants speak from this stage',
};

export const raisedHandsLabel = (n: number) => (n === 1 ? '1 raised hand' : `${n} raised hands`);

/** Your hand, or the hands raised to you; nothing when neither applies. */
export function HandSegment({ self, actions }: { self: CallSelf; actions: CallActions }) {
  if (self.hand === 'speaking') {
    return (
      <Segment
        label="Lower Hand"
        name="Speaking"
        title="You Are Speaking"
        description="Everyone in the Space hears you, as from the stage. Press to lower your hand and end your turn."
        icon={<MicIcon />}
        onClick={actions.lowerHand}
        pressed
        tone="live"
        divided
      />
    );
  }
  if (self.hand === 'raised') {
    return (
      <Segment
        label="Lower Hand"
        name="Lower Hand"
        title="Hand Raised"
        description="The people on the stage see your hand and can let you speak. Press to lower it."
        icon={<HandIcon />}
        onClick={actions.lowerHand}
        pressed
        tone="hand"
        divided
      />
    );
  }
  if (self.stage === 'audience' && self.canSpeak) {
    return (
      <Segment
        label="Raise Hand"
        name="Raise Hand"
        title="Raise Hand"
        description="Ask the stage to let you speak. A hand shows beside your character."
        icon={<HandIcon />}
        onClick={actions.raiseHand}
        pressed={false}
        divided
      />
    );
  }
  if (self.stage === 'speaker' && self.handsUp > 0) {
    const label = raisedHandsLabel(self.handsUp);
    return (
      <Segment
        label={label}
        name={`${self.handsUp} Raised`}
        title={self.handsUp === 1 ? '1 Raised Hand' : `${self.handsUp} Raised Hands`}
        description="Press the hand beside someone to let them speak to the whole Space."
        icon={
          <span className="relative flex">
            <HandIcon />
            <span
              aria-hidden
              className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-400 px-0.5 text-[9px] leading-none font-bold text-amber-950 tabular-nums"
            >
              {self.handsUp > 99 ? '99+' : self.handsUp}
            </span>
          </span>
        }
        tone="hand"
        divided
      />
    );
  }
  return null;
}

/** Do Not Disturb is on: say so in the strip, and let a press clear it. */
export function DoNotDisturbSegment({ onClear }: { onClear?: () => void }) {
  return (
    <Segment
      label="Turn Off Do Not Disturb"
      name="Do Not Disturb"
      title="Do Not Disturb"
      description="Nobody's voice, camera or screen reaches you. You are still heard if you speak. Press to turn it off."
      icon={<DndIcon />}
      onClick={onClear}
      tone="muted"
      divided
    />
  );
}

/** Above the strip while you stand on a stage that does not let you speak. */
export function StageLine({ barredBy }: { barredBy: CallSelf['barredBy'] }) {
  return (
    <span
      data-stage-line=""
      aria-live="polite"
      className="pointer-events-none absolute right-0 bottom-full mb-2 whitespace-nowrap"
    >
      {barredBy ? (
        <span className="block rounded-md bg-slate-900/90 px-2.5 py-1 text-xs font-medium text-white shadow-md motion-safe:animate-card-rise dark:bg-slate-100/95 dark:text-slate-900">
          {STAGE_LINE[barredBy]}
        </span>
      ) : null}
    </span>
  );
}
