'use client';

// The steps in other apps' icons and pictures (blueprint cross-app.md "In the builder"): each step at work, the
// rule's spark running out of this item and landing in the other app (a card on a board, a page that waits to be
// verified, a note on a Space, a new tab, a bell). Drawn from the shared scene parts, moved by automation-scenes.css.
// Decoration only.

import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideBell,
  lucideBookOpenText,
  lucideFilePlus,
  lucideSquareKanban,
  lucideStickyNote,
} from '@liveworkspace/icons/lucide';
import type { CrossAppKind } from '@liveworkspace/automations/cross-app';
import type { GlyphType } from '../kit';
import { Avatar, Pill, ZapGlyph } from '../scene-parts';
import { PANEL, at, type ToneClasses } from '../tile-picker/tile-scene';
import { FlowLine, INK_SOFT, Page, Tab, TabStrip } from '../item/scenes/scene-bits';

export const CROSS_APP_GLYPHS: Readonly<Record<CrossAppKind, GlyphType>> = {
  plan_card: lucideGlyph(lucideSquareKanban, 16),
  kb_page: lucideGlyph(lucideBookOpenText, 16),
  space_post: lucideGlyph(lucideStickyNote, 16),
  doc_tab: lucideGlyph(lucideFilePlus, 16),
  inbox_notice: lucideGlyph(lucideBell, 16),
};

const BellGlyph = lucideGlyph(lucideBell, 11);

// The rule firing here: its spark, then the line out to the other app.
function Spark({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <span className={`grid size-5 shrink-0 place-items-center rounded-md ${tone.solid}`}>
        <ZapGlyph aria-hidden />
      </span>
      <FlowLine tone={tone} className="w-6" />
    </>
  );
}

export const CROSS_APP_SCENES: Readonly<
  Record<CrossAppKind, (p: { tone: ToneClasses }) => React.ReactNode>
> = {
  // A card dropping into another plan's column.
  plan_card: ({ tone }) => (
    <>
      <Spark tone={tone} />
      <div className={`flex h-[46px] w-[78px] shrink-0 gap-1 p-1 ${PANEL}`}>
        {[0, 1].map((col) => (
          <div
            key={col}
            className="flex flex-1 flex-col gap-[3px] rounded-[3px] bg-slate-100 p-[3px] dark:bg-slate-700/60"
          >
            <span className={`h-[5px] w-full ${INK_SOFT}`} />
            {col === 0 ? (
              <span
                className={`ats-t ats-in ats-pop h-[9px] rounded-[2px] ${tone.soft}`}
                style={at('none', 'translateY(-14px) scale(0.6)', 260)}
              />
            ) : (
              <span className="h-[9px] rounded-[2px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-800" />
            )}
          </div>
        ))}
      </div>
    </>
  ),
  // A page written, waiting for someone to verify it.
  kb_page: ({ tone }) => (
    <>
      <Spark tone={tone} />
      <Page className="h-[46px] w-[54px]">
        <Pill
          className="ats-t ats-in ats-pop -bottom-1.5 -right-2 bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-100"
          style={at('none', 'scale(0.4)', 420)}
        >
          Unverified
        </Pill>
      </Page>
    </>
  ),
  // A signed note landing on a Space's tab.
  space_post: ({ tone }) => (
    <>
      <Spark tone={tone} />
      <div className={`relative h-[46px] w-[70px] shrink-0 ${PANEL}`}>
        <span className="absolute left-1.5 top-1.5 size-[14px] rounded-[2px] bg-slate-100 dark:bg-slate-700" />
        <span
          className="ats-t ats-in ats-pop absolute right-1.5 top-2 flex h-[26px] w-[30px] flex-col gap-[3px] rounded-[2px] bg-amber-200 p-[3px] shadow-[0_3px_6px_-3px_rgba(15,23,42,0.4)] dark:bg-amber-400/70"
          style={at('rotate(-3deg)', 'translateX(-18px) scale(0.5)', 260)}
        >
          <span className="h-[2px] w-full rounded-full bg-amber-700/40" />
          <span className="h-[2px] w-2/3 rounded-full bg-amber-700/40" />
        </span>
      </div>
    </>
  ),
  // A tab from a template joining another document.
  doc_tab: ({ tone }) => (
    <>
      <Spark tone={tone} />
      <TabStrip
        className="w-[78px]"
        tabs={
          <>
            <Tab />
            <Tab
              open
              surface={tone.soft}
              className="ats-t ats-in ats-pop origin-bottom"
              style={at('none', 'translateY(6px) scale(0.5)', 260)}
            >
              <span className="h-[3px] w-full rounded-full bg-current opacity-50" />
            </Tab>
          </>
        }
      />
    </>
  ),
  // A notice ringing in someone's Inbox.
  inbox_notice: ({ tone }) => (
    <>
      <Spark tone={tone} />
      <span className={`relative grid size-9 shrink-0 place-items-center ${PANEL}`}>
        <BellGlyph aria-hidden />
        <span
          className="ats-t ats-in ats-pop absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-red-500 text-[7px] font-bold leading-none text-white"
          style={at('none', 'scale(0.2)', 420)}
        >
          <span className="text-optical-centre">1</span>
        </span>
      </span>
      <span className="relative size-[22px] shrink-0 rounded-full bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-slate-800">
        <Avatar who="AL" className="left-1 top-1" />
      </span>
    </>
  ),
};
