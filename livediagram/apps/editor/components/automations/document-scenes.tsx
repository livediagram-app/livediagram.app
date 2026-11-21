'use client';

// The pictures of livediagram's own triggers (docs/specs/013-workspace/automations.md "The screen"; the platform's
// item-ui.md "Pictures"): the moment each trigger hears, resting just before and playing on hover or focus of its
// tile, the bolt lighting as it fires. Drawn from the platform's scene parts at their fixed sizes and moved by its
// automation-scenes.css alone (transform and opacity, no timers), so they sit beside the shared kinds' pictures as
// one family, and stand still on the played moment with no hover, reduced motion or Reduce motion. Loaded with the
// screen. Decoration only.

import { lucideGlyph } from '@liveworkspace/ui';
import { lucideChevronUp, lucideLock } from '@liveworkspace/icons/lucide';
import type { ItemVignette } from '@liveworkspace/automations-ui/item';
import { Board, Fire } from '@liveworkspace/automations-ui/item';
import { Chip, Cursor, SparklesGlyph } from '@liveworkspace/automations-ui/scene-parts';
import { PANEL, at } from '@liveworkspace/automations-ui/tile-picker/tile-scene';

const LockGlyph = lucideGlyph(lucideLock, 7);
const UpGlyph = lucideGlyph(lucideChevronUp, 7);

// A text line, as the shared scenes draw one (scene-bits.tsx INK and INK_SOFT).
const LINE = 'h-[3px] rounded-full';
const INK = `${LINE} bg-slate-300 dark:bg-slate-600`;
const INK_SOFT = `${LINE} bg-slate-200 dark:bg-slate-700`;

// A poll's three answers: where each bar rests while votes come in, where it settles, and its delay.
const BARS: readonly (readonly [number, number, number])[] = [
  [0.45, 0.85, 60],
  [0.55, 0.4, 120],
  [0.3, 0.2, 180],
];

// A Q&A board's questions: the line's width and its upvotes.
const QUESTIONS: readonly (readonly [string, number])[] = [
  ['w-10', 4],
  ['w-8', 2],
];

export const DOCUMENT_TRIGGER_SCENES: Readonly<Record<string, ItemVignette>> = {
  // A live poll's card: its bars settle on the result and it closes.
  poll_ended: ({ tone }) => (
    <div className={`relative flex w-[88px] shrink-0 flex-col gap-[5px] p-1.5 ${PANEL}`}>
      <span className={`w-3/5 ${INK}`} />
      {BARS.map(([rest, settled, d], i) => (
        <span
          key={i}
          className="relative h-[5px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
        >
          <span
            className={`ats-t absolute inset-0 origin-left rounded-full ${i === 0 ? tone.dot : 'bg-slate-300 dark:bg-slate-500'}`}
            style={at(`scaleX(${settled})`, `scaleX(${rest})`, d)}
          />
        </span>
      ))}
      <Chip
        className={`ats-t ats-in ats-pop absolute -bottom-1.5 right-1 ${tone.solid}`}
        style={at('none', 'scale(0.4)', 320)}
      >
        <LockGlyph aria-hidden />
        Closed
      </Chip>
      <Fire tone={tone} d={480} />
    </div>
  ),
  // A Q&A board gaining a note, which takes its first upvote.
  question_asked: ({ tone }) => (
    <div className={`relative flex w-[88px] shrink-0 flex-col gap-[4px] p-1.5 ${PANEL}`}>
      <span
        className={`ats-t ats-in flex h-[12px] items-center gap-1 rounded-[4px] px-1 ${tone.soft}`}
        style={at('none', 'translateY(-6px)', 60)}
      >
        <span className="h-[3px] w-9 rounded-full bg-current opacity-50" />
        <span
          className="ats-t ats-in ats-pop ml-auto inline-flex items-center text-[7px] font-bold leading-none"
          style={at('none', 'scale(0.3)', 260)}
        >
          <UpGlyph aria-hidden />1
        </span>
      </span>
      {QUESTIONS.map(([width, votes]) => (
        <span
          key={votes}
          className="ats-t flex h-[12px] items-center gap-1 px-1"
          style={at('none', 'translateY(-16px)', 60)}
        >
          <span className={`${width} ${INK_SOFT}`} />
          <span className="ml-auto inline-flex items-center text-[7px] font-bold leading-none text-slate-500 dark:text-slate-400">
            <UpGlyph aria-hidden />
            {votes}
          </span>
        </span>
      ))}
      <Fire tone={tone} d={440} />
    </div>
  ),
  // An agent's pointer moving a shape on a small canvas, a sparkle where it lands.
  agent_changed: ({ tone }) => (
    <div className="relative shrink-0">
      <Board
        tone={tone}
        className="h-[46px] w-[68px]"
        rest={['translate(18px, 14px)', 'none', 'none']}
      >
        <span
          className={`ats-t ats-in ats-pop absolute left-[22px] top-[2px] ${tone.label}`}
          style={at('none', 'scale(0.3) rotate(-30deg)', 520)}
        >
          <SparklesGlyph aria-hidden />
        </span>
      </Board>
      <span
        className="ats-t ats-drag absolute left-[14px] top-[12px]"
        style={at('none', 'translate(18px, 14px)', 120)}
      >
        <Cursor name="Agent" />
      </span>
      <Fire tone={tone} d={620} />
    </div>
  ),
};
