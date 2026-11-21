'use client';

// Each shared step's picture, by its tile's key (blueprint item-ui.md "Pictures"; automations.md "Steps every app
// has"): the step at work, resting just before and playing on hover or focus of its tile. Drawn from scene-parts.tsx
// and scene-bits.tsx, moved by automation-scenes.css. Decoration only.

import type { ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideHistory,
  lucideHourglass,
  lucideUsers,
  lucideWebhook,
} from '@liveworkspace/icons/lucide';
import { Avatar, Bubble, Chip, MailGlyph, Pill, SparklesGlyph, ZapGlyph } from '../../scene-parts';
import { PANEL, after, at, type ToneClasses } from '../../tile-picker/tile-scene';
import type { ItemVignette } from '../types';
import {
  Board,
  CameraGlyph,
  FlowLine,
  GlyphTile,
  INK,
  INK_SOFT,
  Page,
  Tab,
  TabStrip,
} from './scene-bits';

const HistoryGlyph = lucideGlyph(lucideHistory, 8);
const HourglassGlyph = lucideGlyph(lucideHourglass, 11);
const WebhookGlyph = lucideGlyph(lucideWebhook, 12);
const TeamsGlyph = lucideGlyph(lucideUsers, 9);

// A channel in another tool, the rule's message landing in it.
function Channel({ tone, label, glyph }: { tone: ToneClasses; label: string; glyph: ReactNode }) {
  return (
    <div className={`flex w-[104px] shrink-0 flex-col overflow-hidden ${PANEL}`}>
      <div className="flex items-center gap-1 border-b border-slate-100 px-1.5 py-[3px] dark:border-slate-700">
        <span className="text-[7px] font-bold leading-none text-slate-800 dark:text-slate-100">
          {label}
        </span>
        <span className="ml-auto flex gap-0.5">
          <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </span>
      </div>
      <div className="flex h-[26px] flex-col justify-end px-1.5 pb-1">
        <div
          className="ats-t ats-in flex items-center gap-1"
          style={at('none', 'translateY(12px)', 220)}
        >
          <span className={`grid size-3 shrink-0 place-items-center rounded ${tone.solid}`}>
            {glyph}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="h-[3px] w-1/2 rounded-full bg-slate-400 dark:bg-slate-500" />
            <span className={`w-full ${INK_SOFT}`} />
          </span>
        </div>
      </div>
    </div>
  );
}

// The AI's sparkle sweeping over a page before it writes.
function Shimmer({ d = 0 }: { d?: number }) {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      <span
        className="ats-t ats-in absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-brand-300/45 to-transparent dark:via-brand-300/25"
        style={at('translateX(220%)', 'translateX(-120%)', d)}
      />
    </span>
  );
}

export const ACTION_SCENES: Readonly<Record<string, ItemVignette>> = {
  // The camera takes the whole item: its picture slides out, named.
  take_snapshot: ({ tone }) => (
    <>
      <Board tone={tone} className="h-[44px] w-[56px]">
        <Bubble
          tone={tone}
          className="ats-t -bottom-1.5 -right-1.5"
          style={at('scale(0.86)', 'none', 80)}
        >
          <CameraGlyph size={11} aria-hidden />
        </Bubble>
      </Board>
      <div
        className="ats-t ats-in ats-pop relative shrink-0 rounded-[5px] bg-white p-[3px] shadow-[0_4px_10px_-4px_rgba(15,23,42,0.45),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-700"
        style={at('rotate(3deg)', 'translateX(-22px) scale(0.5) rotate(-6deg)', 200)}
      >
        <span className={`block h-[20px] w-[30px] rounded-[3px] ${tone.soft}`} />
        <span className="mx-auto mt-[3px] block h-[3px] w-4/5 rounded-full bg-slate-300 dark:bg-slate-500" />
      </div>
    </>
  ),
  // A board gone astray winding back to its pinned snapshot.
  revert_snapshot: ({ tone }) => (
    <>
      <div className="relative shrink-0 rounded-[5px] bg-white p-[3px] shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-slate-700">
        <span className={`block h-[20px] w-[26px] rounded-[3px] ${tone.soft}`} />
        <span
          className={`absolute -left-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full ${tone.solid}`}
        >
          <HistoryGlyph aria-hidden />
        </span>
      </div>
      <FlowLine tone={tone} className="w-4" />
      <Board
        tone={tone}
        rest={[
          'translate(9px, 14px) rotate(-14deg)',
          'translate(-12px, 12px) rotate(11deg)',
          'translate(10px, -16px) rotate(-8deg)',
        ]}
      >
        <Pill
          className={`ats-t ats-in ats-pop -bottom-1.5 -right-1.5 ${tone.solid}`}
          style={at('none', 'scale(0.4)', 520)}
        >
          Back
        </Pill>
      </Board>
    </>
  ),
  // An envelope leaving for someone.
  email: ({ tone }) => (
    <>
      <Page className="h-[40px] w-[44px]" />
      <span className="relative h-5 w-9 shrink-0">
        <Bubble
          tone={tone}
          className="ats-t ats-drag left-0 top-0"
          style={at('translateX(18px)', 'none', 80)}
        >
          <MailGlyph aria-hidden />
        </Bubble>
      </span>
      <span className="relative size-[22px] shrink-0 rounded-full bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:bg-slate-800">
        <Avatar who="AL" className="left-1 top-1" />
        <span
          className="ats-t ats-in ats-pop absolute -right-1 -top-1 grid size-2.5 place-items-center rounded-full bg-red-500 text-[6px] font-bold leading-none text-white"
          style={at('none', 'scale(0.2)', 560)}
        >
          <span className="text-optical-centre">1</span>
        </span>
      </span>
    </>
  ),
  // A template dropping in as the strip's newest tab.
  add_tab: ({ tone }) => (
    <>
      <div
        className={`ats-t ats-out relative flex h-[30px] w-[26px] shrink-0 flex-col gap-[3px] rounded-md border border-dashed p-1 ${tone.border}`}
        style={at('translateX(16px) scale(0.7)', 'none', 0)}
      >
        <span className={`h-[7px] rounded-[2px] ${tone.soft}`} />
        <span className={`w-full ${INK_SOFT}`} />
        <span className={`w-2/3 ${INK_SOFT}`} />
      </div>
      <TabStrip
        className="w-[80px]"
        tabs={
          <>
            <Tab />
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
      >
        <span
          className={`ats-t ats-in absolute bottom-1.5 right-1.5 h-[7px] w-[22px] origin-left rounded-[2px] ${tone.soft}`}
          style={at('none', 'scaleX(0.2)', 380)}
        />
      </TabStrip>
    </>
  ),
  // A signed event running down the line to your own service.
  notify_webhook: ({ tone }) => (
    <>
      <span className={`grid size-5 shrink-0 place-items-center rounded-md ${tone.solid}`}>
        <ZapGlyph aria-hidden />
      </span>
      <FlowLine tone={tone} className="w-9" />
      <GlyphTile tone={tone}>
        <WebhookGlyph aria-hidden />
        <Chip
          className="ats-t ats-in ats-pop absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-100"
          style={at('none', 'scale(0.4)', 480)}
        >
          200
        </Chip>
      </GlyphTile>
    </>
  ),
  notify_slack: ({ tone }) => (
    <Channel tone={tone} label="# launch" glyph={<ZapGlyph aria-hidden />} />
  ),
  notify_teams: ({ tone }) => (
    <Channel tone={tone} label="Launch Team" glyph={<TeamsGlyph aria-hidden />} />
  ),
  // The sparkle reading the page, and the summary it keeps for the steps after.
  ai_summarise: ({ tone }) => (
    <>
      <div className="relative shrink-0">
        <Page className="h-[44px] w-[50px]" lines={4} />
        <Shimmer d={60} />
      </div>
      <div
        className={`ats-t ats-in relative flex w-[52px] shrink-0 flex-col gap-[3px] rounded-md p-1.5 ${tone.soft}`}
        style={at('none', 'translateX(-14px) scale(0.7)', 420)}
      >
        <span className="flex items-center gap-0.5 text-[6.5px] font-bold leading-none">
          <SparklesGlyph aria-hidden />
          Summary
        </span>
        <span className="h-[3px] w-full rounded-full bg-current opacity-40" />
        <span className="h-[3px] w-2/3 rounded-full bg-current opacity-40" />
      </div>
    </>
  ),
  // The hourglass turning over while the rest of the rule holds.
  wait: ({ tone }) => (
    <>
      <span className={`h-[3px] w-5 shrink-0 ${INK}`} />
      <div
        className={`relative flex w-[64px] shrink-0 flex-col items-center gap-1.5 px-2 py-1.5 ${PANEL}`}
      >
        <span className={`ats-t ats-turn ${tone.label}`} style={at('rotate(180deg)', 'none', 80)}>
          <HourglassGlyph aria-hidden />
        </span>
        <span className="h-[3px] w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <span
            className={`ats-t ats-fill block h-full origin-left rounded-full ${tone.dot}`}
            style={at('none', 'scaleX(0.12)', 80)}
          />
        </span>
        <Chip className={`absolute -right-2 -top-2 ${tone.soft}`}>
          <span className="inline-grid">
            <span className="ats-out col-start-1 row-start-1" style={after(700)}>
              1 day
            </span>
            <span className="ats-in col-start-1 row-start-1" style={after(700)}>
              Now
            </span>
          </span>
        </Chip>
      </div>
      <span
        className={`ats-t ats-in h-[3px] w-5 shrink-0 origin-left rounded-full ${tone.dot}`}
        style={at('none', 'scaleX(0.2)', 900)}
      />
    </>
  ),
};
