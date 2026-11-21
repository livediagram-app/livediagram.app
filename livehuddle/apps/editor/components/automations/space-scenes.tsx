'use client';

// The pictures of livehuddle's own kinds (docs/specs/013-workspace/automations.md "The screen"; the platform's
// item-ui.md "Pictures"): the moment each trigger hears, or each step makes, resting just before and playing on hover
// or focus of its tile, a trigger's bolt lighting as it fires. Drawn from the platform's scene parts at their fixed
// sizes and moved by its automation-scenes.css alone (transform and opacity, no timers), so they sit beside the
// shared kinds' pictures as one family, and stand still on the played moment with no hover, reduced motion or Reduce
// motion. Loaded with the screen. Decoration only.

import type { CSSProperties, ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideBrushCleaning, lucideClock } from '@liveworkspace/icons/lucide';
import type { GlyphType } from '@liveworkspace/automations-ui/kit';
import type { ItemVignette } from '@liveworkspace/automations-ui/item';
import { Fire } from '@liveworkspace/automations-ui/item';
import { Avatar, Chip, Count, Pill } from '@liveworkspace/automations-ui/scene-parts';
import {
  PANEL,
  at,
  after,
  type ToneClasses,
} from '@liveworkspace/automations-ui/tile-picker/tile-scene';

const ClockGlyph = lucideGlyph(lucideClock, 8);
const BrushGlyph = lucideGlyph(lucideBrushCleaning, 8);

/** Clear the Suggestion Box's icon on its blue tile, as the shared steps' (ITEM_ACTION_GLYPHS). */
export const SPACE_ACTION_GLYPHS: Readonly<Record<string, GlyphType>> = {
  clear_suggestions: lucideGlyph(lucideBrushCleaning, 16),
};

// The room's lights going out, over everything in it but its lamp: dimmed at rest (`dark`) or as it plays.
const DIM = 'pointer-events-none absolute inset-0 rounded-lg bg-slate-900/30 dark:bg-black/45';

/** A room seen from the front: its floor, its doorway on the left and its lamp, and whoever stands in it. `lit`
 *  draws the lamp's light, `children` the people and the dimming. */
function Room({ lit, children }: { lit: ReactNode; children?: ReactNode }) {
  return (
    <div className={`relative h-[44px] w-[68px] shrink-0 ${PANEL}`}>
      {/* The floor, and the doorway people come and go by. */}
      <span className="absolute inset-x-1.5 bottom-[5px] h-[2px] rounded-full bg-slate-200 dark:bg-slate-700" />
      <span className="absolute bottom-[5px] left-0 h-[22px] w-[4px] rounded-r-[2px] bg-slate-300 dark:bg-slate-600" />
      {/* The lamp hanging from the ceiling, its shade the tone's when lit. */}
      <span className="absolute left-[38px] top-0 h-[5px] w-px bg-slate-300 dark:bg-slate-600" />
      <span className="absolute left-[34px] top-[5px] h-[4px] w-[9px] rounded-t-full bg-slate-300 dark:bg-slate-600" />
      {lit}
      {children}
    </div>
  );
}

/** The lamp's light: its shade in the tone and a soft cone down to the floor. */
function Light({
  tone,
  className,
  style,
}: {
  tone: ToneClasses;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <span className={className} style={style}>
      <span
        className={`absolute left-[34px] top-[5px] h-[4px] w-[9px] rounded-t-full ${tone.dot}`}
      />
      <span
        className={`absolute left-[24px] top-[9px] h-[30px] w-[29px] opacity-60 [clip-path:polygon(35%_0,65%_0,100%_100%,0_100%)] ${tone.soft}`}
      />
    </span>
  );
}

/** The Suggestion Box: a white box with a slot in its lid and a label, `children` standing on it. */
function SuggestionBox({ children }: { children?: ReactNode }) {
  return (
    <div
      className={`relative flex h-[30px] w-[46px] shrink-0 flex-col items-center gap-[4px] pt-[5px] ${PANEL}`}
    >
      <span className="h-[3px] w-[24px] rounded-full bg-slate-700/70 dark:bg-slate-950" />
      <span className="h-[3px] w-[20px] rounded-full bg-slate-200 dark:bg-slate-700" />
      <span className="h-[3px] w-[14px] rounded-full bg-slate-200 dark:bg-slate-700" />
      {children}
    </div>
  );
}

// A sticky note, as the Suggestion Box takes them.
const NOTE =
  'absolute block size-[13px] rounded-[2px] bg-amber-200 shadow-[0_2px_4px_-1px_rgba(15,23,42,0.3)] dark:bg-amber-300/90';

// The notes peeking out of the box's slot before it is cleared: where each sits, and where it lifts to.
const PEEKING: readonly (readonly [string, string, number])[] = [
  ['left-[9px] -top-[9px] rotate-[-10deg]', 'translate(-12px, -14px) rotate(-30deg)', 80],
  ['left-[17px] -top-[11px] rotate-[4deg]', 'translate(0px, -18px) rotate(10deg)', 160],
  ['left-[25px] -top-[9px] rotate-[12deg]', 'translate(12px, -14px) rotate(32deg)', 240],
];

export const SPACE_TRIGGER_SCENES: Readonly<Record<string, ItemVignette>> = {
  // An avatar walking in at the door of a dark, empty room, and the lights coming up.
  someone_arrived: ({ tone }) => (
    <div className="relative shrink-0">
      <Room lit={<Light tone={tone} className="ats-in absolute inset-0" style={after(320)} />}>
        <span className={`ats-out ${DIM}`} style={after(320)} />
        <Avatar
          who="KP"
          className="ats-t ats-drag bottom-[7px] left-[30px]"
          style={at('none', 'translateX(-24px)', 60)}
        />
      </Room>
      <Fire tone={tone} d={520} />
    </div>
  ),
  // The last avatar walking out at the door, the lights going down and a clock running down.
  everyone_left: ({ tone }) => (
    <div className="relative shrink-0">
      <Room lit={<Light tone={tone} className="ats-out absolute inset-0" style={after(300)} />}>
        <span className={`ats-in ${DIM}`} style={after(300)} />
        <Avatar
          who="JR"
          className="ats-t ats-drag ats-out bottom-[7px] left-[30px]"
          style={at('translateX(-26px)', 'none', 40)}
        />
      </Room>
      <Pill className={`-bottom-1.5 -right-2 ${tone.soft}`}>
        <ClockGlyph aria-hidden />
        <span className="grid">
          <Count from={10} to={0} d={460} />
        </span>
        min
      </Pill>
      <Fire tone={tone} d={640} />
    </div>
  ),
  // A note dropping through the box's slot, and the box's count going up.
  suggestion_dropped: ({ tone }) => (
    <div className="relative shrink-0 pt-[14px]">
      <span
        className={`ats-t ats-drag ats-out ${NOTE} left-[17px] top-0`}
        style={at('translateY(14px) scale(0.6)', 'translateY(-2px) rotate(-8deg)', 60)}
      />
      <SuggestionBox>
        <Chip className={`absolute -bottom-1.5 -right-2 ${tone.soft}`}>
          <span className="grid">
            <Count from={2} to={3} d={420} />
          </span>
        </Chip>
      </SuggestionBox>
      <Fire tone={tone} d={540} className="-right-2 top-[6px]" />
    </div>
  ),
};

export const SPACE_ACTION_SCENES: Readonly<Record<string, ItemVignette>> = {
  // The notes lifting out of the box and away, and the box left empty.
  clear_suggestions: ({ tone }) => (
    <div className="relative shrink-0 pt-[14px]">
      <SuggestionBox>
        {PEEKING.map(([place, away, d]) => (
          <span key={d} className={`ats-t ats-out ${NOTE} ${place}`} style={at(away, 'none', d)} />
        ))}
        <Pill
          className={`ats-t ats-in ats-pop -bottom-1.5 -right-2.5 ${tone.solid}`}
          style={at('none', 'scale(0.4)', 420)}
        >
          <BrushGlyph aria-hidden />
          Empty
        </Pill>
      </SuggestionBox>
    </div>
  ),
};
