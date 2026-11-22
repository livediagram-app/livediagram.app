'use client';

// The pictures of a knowledgebase's own trust and AI Knowledge kinds (docs/specs/013-workspace/automations.md "The
// screen"; the platform's item-ui.md "Pictures"): the moment each trigger hears, or each step makes, resting just
// before and playing on hover or focus of its tile. Drawn from the platform's scene parts at their fixed sizes and
// moved by its automation-scenes.css alone (transform and opacity, no timers), so they sit beside the shared kinds'
// pictures as one family, and stand still on the played moment with no hover or with reduced motion. The page's own
// marks (the green tick, the amber Review Due pill, the owner's initials) are drawn as the page shows them, in the
// scene's tone. Loaded with the screen. Decoration only.

import type { CSSProperties } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideCircleCheck,
  lucideCircleHelp,
  lucideClock,
  lucideEraser,
  lucideLayers,
  lucideMail,
  lucideScale,
  lucideShieldCheck,
  lucideUser,
} from '@liveworkspace/icons/lucide';
import type { GlyphType } from '@liveworkspace/automations-ui/kit';
import type { ItemVignette } from '@liveworkspace/automations-ui/item';
import { Fire, FlowLine, Page } from '@liveworkspace/automations-ui/item';
import { Cursor, Pill, SparklesGlyph } from '@liveworkspace/automations-ui/scene-parts';
import { PANEL, at, type ToneClasses } from '@liveworkspace/automations-ui/tile-picker/tile-scene';

const TickGlyph = lucideGlyph(lucideCircleCheck, 8);
const ClockGlyph = lucideGlyph(lucideClock, 7);
const AskGlyph = lucideGlyph(lucideCircleHelp, 9);
const MailGlyph = lucideGlyph(lucideMail, 9);
const ScaleGlyph = lucideGlyph(lucideScale, 11);
const ShieldGlyph = lucideGlyph(lucideShieldCheck, 9);

const LINE = 'h-[3px] rounded-full';
const INK = `${LINE} bg-slate-300 dark:bg-slate-600`;
const INK_SOFT = `${LINE} bg-slate-200 dark:bg-slate-700`;

/** The steps' icons on their blue tiles, as the shared steps' (ITEM_ACTION_GLYPHS). */
export const KNOWLEDGE_ACTION_GLYPHS: Readonly<Record<string, GlyphType>> = {
  set_owner: lucideGlyph(lucideUser, 16),
  clear_verification: lucideGlyph(lucideEraser, 16),
  email_owner: lucideGlyph(lucideMail, 16),
  context: lucideGlyph(lucideLayers, 16),
};

/** A person's initials in a round badge, as a page's owner shows. */
function Owner({
  initials,
  className,
  style,
}: {
  initials: string;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`grid size-[15px] place-items-center rounded-full text-[6.5px] font-bold leading-none ring-2 ring-white dark:ring-slate-800 ${className}`}
      style={style}
    >
      <span className="text-optical-centre">{initials}</span>
    </span>
  );
}

/** Two pages side by side, one line on each in the tone: two answers to one question. */
function DisagreeingPages({ tone }: { tone: ToneClasses }) {
  return (
    <>
      {[0, 1].map((side) => (
        <Page key={side} className="h-[44px] w-[44px]" lines={1}>
          <span
            className={`ats-t ats-in ${side === 0 ? 'w-full' : 'w-3/5'} ${LINE} ${tone.dot}`}
            style={at(
              'none',
              side === 0 ? 'translateX(-6px)' : 'translateX(6px)',
              120 + side * 100,
            )}
          />
        </Page>
      ))}
    </>
  );
}

export const KNOWLEDGE_TRIGGER_SCENES: Readonly<Record<string, ItemVignette>> = {
  // A page gaining the green tick of Verified.
  page_verified: ({ tone }) => (
    <Page className="h-[46px] w-[70px]">
      <Pill
        className={`ats-t ats-in ats-pop -right-2 -top-2 ${tone.solid}`}
        style={at('none', 'scale(0.3)', 200)}
      >
        <TickGlyph aria-hidden />
        Verified
      </Pill>
      <Fire tone={tone} d={480} />
    </Page>
  ),
  // The amber Review Due pill sliding onto a page whose tick has faded.
  review_due: ({ tone }) => (
    <Page className="h-[46px] w-[70px]">
      <span
        className="ats-t ats-out absolute -right-1.5 -top-1.5 text-emerald-500"
        style={at('scale(0.6)', 'none', 80)}
      >
        <TickGlyph aria-hidden />
      </span>
      <Pill
        className={`ats-t ats-in -bottom-1.5 -right-2 ${tone.solid}`}
        style={at('none', 'translateY(8px)', 260)}
      >
        <ClockGlyph aria-hidden />
        Review Due
      </Pill>
      <Fire tone={tone} d={520} />
    </Page>
  ),
  // One owner's initials giving way to another's on a page.
  owner_changed: ({ tone }) => (
    <Page className="h-[46px] w-[70px]">
      <span className="absolute -right-1.5 -top-1.5">
        <Owner
          initials="AC"
          className="ats-t ats-out absolute bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-100"
          style={at('translateY(-6px) scale(0.6)', 'none', 100)}
        />
        <Owner
          initials="PS"
          className={`ats-t ats-in ats-pop ${tone.solid}`}
          style={at('none', 'translateY(6px) scale(0.6)', 260)}
        />
      </span>
      <Fire tone={tone} d={500} />
    </Page>
  ),
  // A question asked, and nothing under it where an answer would be.
  question_unanswered: ({ tone }) => (
    <div className={`relative flex w-[84px] shrink-0 flex-col gap-[4px] p-1.5 ${PANEL}`}>
      <span className={`flex items-center gap-1 ${tone.label}`}>
        <AskGlyph aria-hidden />
        <span className={`w-10 ${LINE} ${tone.dot}`} />
      </span>
      <span
        className="ats-t ats-in h-[14px] rounded-[3px] border border-dashed border-slate-300 dark:border-slate-600"
        style={at('none', 'scaleY(0.4)', 220)}
      />
      <Fire tone={tone} d={480} />
    </div>
  ),
  // Two pages with opposite lines, the scales between them.
  pages_disagree: ({ tone }) => (
    <div className="relative flex items-center gap-1.5">
      <DisagreeingPages tone={tone} />
      <span
        className={`ats-t ats-in ats-pop absolute left-1/2 top-[-6px] -translate-x-1/2 ${tone.label}`}
        style={at('none', 'scale(0.4)', 320)}
      >
        <ScaleGlyph aria-hidden />
      </span>
      <Fire tone={tone} d={560} />
    </div>
  ),
  // An agent's sparkle over a page of removed and added lines.
  suggestion_added: ({ tone }) => (
    <div className="relative shrink-0">
      <Page className="h-[46px] w-[70px]" lines={1}>
        <span className={`w-4/5 ${LINE} bg-rose-300 dark:bg-rose-500/70`} />
        <span
          className={`ats-t ats-in w-3/5 origin-left ${LINE} bg-emerald-400 dark:bg-emerald-500/80`}
          style={at('none', 'scaleX(0.1)', 260)}
        />
        <span
          className={`ats-t ats-in ats-pop absolute right-[6px] top-[3px] ${tone.label}`}
          style={at('none', 'scale(0.3) rotate(-30deg)', 420)}
        >
          <SparklesGlyph aria-hidden />
        </span>
      </Page>
      <span
        className="ats-t ats-drag absolute left-[14px] top-[24px]"
        style={at('translate(22px, 6px)', 'none', 120)}
      >
        <Cursor name="Agent" />
      </span>
      <Fire tone={tone} d={600} />
    </div>
  ),
};

export const KNOWLEDGE_ACTION_SCENES: Readonly<Record<string, ItemVignette>> = {
  // The owner's initials landing on a page.
  set_owner: ({ tone }) => (
    <Page className="h-[46px] w-[70px]">
      <Owner
        initials="PS"
        className={`ats-t ats-in ats-pop absolute -right-1.5 -top-1.5 ${tone.solid}`}
        style={at('none', 'translate(10px, -10px) scale(0.4)', 180)}
      />
    </Page>
  ),
  // The green tick lifting off a page.
  clear_verification: () => (
    <Page className="h-[46px] w-[70px]">
      <Pill
        className="ats-t ats-out -right-2 -top-2 bg-emerald-500 text-white"
        style={at('translateY(-8px) scale(0.6)', 'none', 160)}
      >
        <TickGlyph aria-hidden />
        Verified
      </Pill>
    </Page>
  ),
  // An envelope travelling from a page to its owner.
  email_owner: ({ tone }) => (
    <>
      <Page className="h-[44px] w-[44px]" lines={2} />
      <FlowLine tone={tone} className="w-4" />
      <span className="relative">
        <Owner
          initials="PS"
          className="bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-100"
        />
        <span
          className={`ats-t ats-in ats-drag absolute -right-2 -top-2 ${tone.label}`}
          style={at('none', 'translate(-18px, 4px)', 140)}
        >
          <MailGlyph aria-hidden />
        </span>
      </span>
    </>
  ),
  // A page joining the stack every agent is handed.
  context: ({ tone }) => (
    <div className="relative h-[46px] w-[64px] shrink-0">
      {[0, 1].map((i) => (
        <span
          key={i}
          className={`absolute h-[30px] w-[44px] ${PANEL}`}
          style={{ left: 14 - i * 5, top: 12 - i * 5 }}
        >
          <span className={`m-1.5 block w-1/2 ${i === 0 ? INK : INK_SOFT}`} />
        </span>
      ))}
      <span
        className={`ats-t ats-in absolute left-[20px] top-[16px] h-[30px] w-[44px] ${PANEL}`}
        style={at('none', 'translate(14px, 12px) rotate(8deg)', 160)}
      >
        <span className={`m-1.5 block w-3/5 ${LINE} ${tone.dot}`} />
        <span className={`absolute -right-1 -top-1.5 ${tone.label}`}>
          <ShieldGlyph aria-hidden />
        </span>
      </span>
    </div>
  ),
};
