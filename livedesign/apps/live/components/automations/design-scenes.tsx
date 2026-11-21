'use client';

// The pictures of livedesign's own triggers (docs/specs/013-workspace/automations.md "The screen"; the platform's
// item-ui.md "Pictures"): the moment each one hears, resting just before and playing on hover or focus of its tile,
// its bolt lighting as it fires. Drawn from the platform's scene parts at their fixed sizes and moved by its
// automation-scenes.css alone (transform and opacity, no timers), so they sit beside the shared kinds' pictures as one
// family, and stand still on the played moment with no hover, reduced motion or Reduce motion. Loaded with the
// screen. Decoration only.

import type { ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucidePackage } from '@liveworkspace/icons/lucide';
import type { ItemVignette } from '@liveworkspace/automations-ui/item';
import { Fire } from '@liveworkspace/automations-ui/item';
import { Cursor, SparklesGlyph } from '@liveworkspace/automations-ui/scene-parts';
import { PANEL, at, type ToneClasses } from '@liveworkspace/automations-ui/tile-picker/tile-scene';

// A main component's mark: the palette's components band draws its mains with the same package (component-tiles.tsx).
const MainGlyph = lucideGlyph(lucidePackage, 7);

// A text line, as the shared scenes draw one (scene-bits.tsx INK and INK_SOFT).
const LINE = 'h-[3px] rounded-full';
const INK = `${LINE} bg-slate-300 dark:bg-slate-600`;
const INK_SOFT = `${LINE} bg-slate-200 dark:bg-slate-700`;

// A button as a main draws it: its old face fading out, its new one (the tone's) taking its place. `d` is when.
function ButtonFace({ tone, d, small = false }: { tone: ToneClasses; d: number; small?: boolean }) {
  const size = small ? 'h-[7px] w-[18px]' : 'h-[9px] w-[26px]';
  return (
    <span className={`relative block ${size}`}>
      <span
        className="ats-out absolute inset-0 rounded-[2px] bg-slate-200 dark:bg-slate-600"
        style={at('none', 'none', d)}
      />
      <span
        className={`ats-t ats-in ats-pop absolute inset-0 rounded-full ${tone.dot}`}
        style={at('none', 'scaleX(0.6)', d)}
      />
    </span>
  );
}

/** The main: a frame wearing its mark, a heading and the button that changes. */
function MainFrame({ tone }: { tone: ToneClasses }) {
  return (
    <div className={`relative flex h-[44px] w-[48px] shrink-0 flex-col gap-[4px] p-1.5 ${PANEL}`}>
      <span
        className={`absolute -left-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full ${tone.solid}`}
      >
        <MainGlyph aria-hidden />
      </span>
      <span className={`ml-auto w-1/2 ${INK}`} />
      <span className={`w-4/5 ${INK_SOFT}`} />
      <span className="mt-auto">
        <ButtonFace tone={tone} d={120} />
      </span>
    </div>
  );
}

/** An instance: a smaller dashed copy of the main, following it a beat later (`d`). */
function InstanceFrame({ tone, d }: { tone: ToneClasses; d: number }) {
  return (
    <div className="flex h-[22px] w-[30px] flex-col justify-between rounded-[5px] border border-dashed border-slate-300 bg-white p-[3px] dark:border-slate-600 dark:bg-slate-800">
      <span className={`w-3/4 ${INK_SOFT}`} />
      <ButtonFace tone={tone} d={d} small />
    </div>
  );
}

/** A frame of a wireframe page: its name above it, the way the canvas labels one, and what stands in it. */
function ArtFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="relative shrink-0 pt-[7px]">
      <span className={`absolute left-0 top-0 w-5 ${INK}`} />
      <div className={`relative h-[40px] w-[66px] ${PANEL}`}>
        <span className="absolute left-[6px] top-[6px] h-[7px] w-[22px] rounded-[2px] bg-slate-200 dark:bg-slate-600" />
        <span className={`absolute left-[6px] top-[17px] w-[40px] ${INK_SOFT}`} />
        {children}
      </div>
    </div>
  );
}

export const DESIGN_TRIGGER_SCENES: Readonly<Record<string, ItemVignette>> = {
  // A main component's button changes, and its two instances follow it.
  component_changed: ({ tone }) => (
    <div className="relative flex shrink-0 items-center gap-2">
      <MainFrame tone={tone} />
      <div className="flex flex-col gap-1.5">
        <InstanceFrame tone={tone} d={300} />
        <InstanceFrame tone={tone} d={380} />
      </div>
      <Fire tone={tone} d={600} className="-right-1.5 -top-2.5" />
    </div>
  ),
  // An agent's pointer drags a block into a frame, a sparkle where it lands.
  agent_changed: ({ tone }) => (
    <div className="relative shrink-0">
      <ArtFrame>
        <span
          className={`ats-t ats-drag absolute bottom-[6px] right-[6px] h-[10px] w-[24px] rounded-[2px] ${tone.soft}`}
          style={at('none', 'translate(18px, 12px)', 120)}
        />
        <span
          className={`ats-t ats-in ats-pop absolute right-[3px] top-[3px] ${tone.label}`}
          style={at('none', 'scale(0.3) rotate(-30deg)', 520)}
        >
          <SparklesGlyph aria-hidden />
        </span>
      </ArtFrame>
      <span
        className="ats-t ats-drag absolute left-[48px] top-[36px]"
        style={at('none', 'translate(18px, 12px)', 120)}
      >
        <Cursor name="Agent" />
      </span>
      <Fire tone={tone} d={620} />
    </div>
  ),
};
