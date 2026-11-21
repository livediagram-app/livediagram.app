'use client';

// Each shared trigger's picture (blueprint item-ui.md "Pictures"; automations.md "Triggers every app has"): the
// moment the trigger hears, resting just before and playing on hover or focus of its tile, the bolt lighting as it
// fires. Drawn from scene-parts.tsx and scene-bits.tsx, moved by automation-scenes.css. Decoration only.

import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideClock,
  lucideLock,
  lucidePencil,
  lucideWebhook,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { Avatar, CheckGlyph, Chip, Cursor, LinkGlyph, Pill, ZapGlyph } from '../../scene-parts';
import { PANEL, after, at, type ToneClasses } from '../../tile-picker/tile-scene';
import type { ItemVignette } from '../types';
import {
  CameraGlyph,
  CommentBubble,
  Fire,
  FlowLine,
  GlyphTile,
  INK,
  INK_SOFT,
  Page,
  Tab,
  TabStrip,
} from './scene-bits';

const ClockFace = lucideGlyph(lucideClock, 16);
const SmallClock = lucideGlyph(lucideClock, 8);
const WebhookGlyph = lucideGlyph(lucideWebhook, 12);
const PencilGlyph = lucideGlyph(lucidePencil, 9);
const LockGlyph = lucideGlyph(lucideLock, 12);
const CrossGlyph = lucideGlyph(lucideX, 7);

const WEEK = ['M', 'T', 'W', 'T', 'F'] as const;

// A row of an action list: its box (ticked or open), its line, and what the scene puts at its end.
function ActionRow({
  tone,
  ticked = false,
  tick,
  children,
}: {
  tone: ToneClasses;
  ticked?: boolean;
  // The delay its tick lands after, for the row the scene ticks.
  tick?: number;
  children?: React.ReactNode;
}) {
  return (
    <span className="relative flex h-[10px] items-center gap-1">
      <span className="relative grid size-2.5 shrink-0 place-items-center rounded-[3px] ring-1 ring-slate-300 dark:ring-slate-600">
        {ticked || tick !== undefined ? (
          <span
            className={`grid size-2.5 place-items-center rounded-[3px] ${tone.solid} ${tick === undefined ? '' : 'ats-t ats-in ats-pop'}`}
            style={tick === undefined ? undefined : at('none', 'scale(0.2)', tick)}
          >
            <CheckGlyph aria-hidden />
          </span>
        ) : null}
      </span>
      <span className={`w-9 ${ticked ? INK_SOFT : INK}`} />
      {children}
    </span>
  );
}

export const TRIGGER_SCENES: Readonly<Record<string, ItemVignette>> = {
  // A clock face on its hour, the week's days beside it, today's lighting.
  scheduled: ({ tone }) => (
    <>
      <GlyphTile tone={tone} round className="size-11">
        <ClockFace aria-hidden />
        <Chip className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 ${tone.solid}`}>9:00</Chip>
        <Fire tone={tone} d={420} />
      </GlyphTile>
      <div className={`flex shrink-0 gap-[3px] p-1.5 ${PANEL}`}>
        {WEEK.map((day, i) => (
          <span
            key={i}
            className="relative grid size-[11px] place-items-center rounded-[3px] bg-slate-100 text-[6px] font-bold leading-none text-slate-500 dark:bg-slate-700 dark:text-slate-300"
          >
            {day}
            {i === 2 ? (
              <span
                className={`ats-t ats-in ats-pop absolute inset-0 grid place-items-center rounded-[3px] ${tone.solid}`}
                style={at('none', 'scale(0.4)', 160)}
              >
                {day}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </>
  ),
  // A rule's row, the pointer coming to its Run Rule button and pressing it.
  manual: ({ tone }) => (
    <div className={`relative flex w-[104px] shrink-0 items-center gap-1.5 p-1.5 ${PANEL}`}>
      <span className={`grid size-3.5 shrink-0 place-items-center rounded ${tone.soft}`}>
        <ZapGlyph aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className={`w-4/5 ${INK}`} />
        <span className={`w-1/2 ${INK_SOFT}`} />
      </span>
      <span
        className={`ats-press shrink-0 rounded px-1 text-[6.5px] font-bold leading-[11px] ${tone.solid}`}
      >
        Run Rule
      </span>
      <span
        className="ats-t absolute -bottom-2.5 right-1"
        style={at('none', 'translate(14px, 9px)', 0)}
      >
        <Cursor />
      </span>
      <Fire tone={tone} d={340} />
    </div>
  ),
  // Another tool's call running down the line to the page.
  incoming_webhook: ({ tone }) => (
    <>
      <GlyphTile tone={tone}>
        <WebhookGlyph aria-hidden />
      </GlyphTile>
      <FlowLine tone={tone} />
      <div className="relative shrink-0">
        <Page className="h-[40px] w-[44px]" />
        <Fire tone={tone} d={420} />
      </div>
    </>
  ),
  // A strip of tabs gaining one.
  tab_added: ({ tone }) => (
    <TabStrip
      tabs={
        <>
          <Tab open />
          <Tab />
          <Tab
            surface={tone.soft}
            className="ats-t ats-in ats-pop origin-bottom"
            style={at('none', 'translateY(6px) scale(0.5)', 120)}
          >
            <span className="h-[3px] w-full rounded-full bg-current opacity-50" />
          </Tab>
        </>
      }
    >
      <Pill
        className={`ats-t ats-in ats-pop -top-[15px] right-0 ${tone.solid}`}
        style={at('none', 'scale(0.4)', 260)}
      >
        New
      </Pill>
      <Fire tone={tone} d={440} className="-right-1.5 top-2" />
    </TabStrip>
  ),
  // A strip of tabs losing its last.
  tab_removed: ({ tone }) => (
    <TabStrip
      tabs={
        <>
          <Tab open />
          <Tab />
          <span
            className="ats-t ats-out relative origin-bottom"
            style={at('translateY(6px) scale(0.6)', 'none', 160)}
          >
            <Tab surface="bg-red-100 dark:bg-red-500/25">
              <span className="h-[3px] w-full rounded-full bg-red-300 dark:bg-red-300/60" />
            </Tab>
            <span className="absolute -right-1 -top-1 grid size-2.5 place-items-center rounded-full bg-red-500 text-white">
              <CrossGlyph aria-hidden />
            </span>
          </span>
        </>
      }
    >
      <Fire tone={tone} d={440} className="-right-1.5 top-2" />
    </TabStrip>
  ),
  // A page being written, then settling: the pencil lifts and the quiet's clock comes up.
  edited: ({ tone }) => (
    <div className="relative shrink-0">
      <Page className="h-[46px] w-[64px]" lines={2}>
        <span
          className={`ats-t h-[3px] w-4/5 origin-left rounded-full ${tone.dot}`}
          style={at('none', 'scaleX(0.25)', 0)}
        />
        <span
          className={`ats-t ats-out absolute left-[14px] top-[22px] ${tone.label}`}
          style={at('translate(30px, -2px)', 'none', 0)}
        >
          <PencilGlyph aria-hidden />
        </span>
        <Pill
          className={`ats-t ats-in ats-pop bottom-1 right-1 shadow-none ${tone.soft}`}
          style={at('none', 'scale(0.4)', 420)}
        >
          <SmallClock aria-hidden />
          30 min
        </Pill>
      </Page>
      <Fire tone={tone} d={620} />
    </div>
  ),
  // A page nobody has touched: its count of days, and its sleep.
  not_edited: ({ tone }) => (
    <div className="relative shrink-0">
      <div className="opacity-70">
        <Page className="h-[46px] w-[64px]" />
      </div>
      <Pill
        className={`ats-t bottom-1 right-1 shadow-none ${tone.soft}`}
        style={at('scale(1.12)', 'none', 220)}
      >
        <SmallClock aria-hidden />
        30 days
      </Pill>
      {[
        ['-left-2 top-2 text-[9px]', 60],
        ['-left-3.5 -top-1 text-[7px]', 180],
      ].map(([place, d]) => (
        <span
          key={d}
          className={`ats-t ats-in absolute font-bold leading-none text-slate-500 dark:text-slate-400 ${place}`}
          style={at('none', 'translateY(4px)', Number(d))}
        >
          z
        </span>
      ))}
      <Fire tone={tone} d={380} />
    </div>
  ),
  // Someone's own snapshot: the camera, and the picture it took landing beside it.
  snapshot_taken: ({ tone }) => (
    <>
      <GlyphTile tone={tone} className="size-10">
        <CameraGlyph size={16} aria-hidden />
        <Avatar who="AL" className="-bottom-1 -left-1" />
      </GlyphTile>
      <div
        className="ats-t ats-in ats-pop relative shrink-0 rounded-[5px] bg-white p-[3px] shadow-[0_4px_10px_-4px_rgba(15,23,42,0.45),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-slate-700"
        style={at('rotate(4deg)', 'translateX(-18px) scale(0.5) rotate(-8deg)', 120)}
      >
        <span className={`block h-[24px] w-[34px] rounded-[3px] ${tone.soft}`} />
        <Fire tone={tone} d={440} />
      </div>
    </>
  ),
  // A person arriving through the share link, beside who was here.
  joined: ({ tone }) => (
    <div className="relative shrink-0">
      <Page className="h-[44px] w-[72px]" />
      <Avatar who="AL" className="bottom-1.5 left-1.5" />
      <Avatar who="JR" className="bottom-1.5 left-[15px]" />
      <Avatar
        who="KP"
        className="ats-t ats-in ats-pop bottom-1.5 left-[24px]"
        style={at('none', 'translate(22px, 10px) scale(0.4)', 120)}
      />
      <Chip
        className={`ats-t ats-in absolute -bottom-1.5 right-1 ${tone.soft}`}
        style={at('none', 'translateY(4px)', 300)}
      >
        <LinkGlyph aria-hidden />
        Joined
      </Chip>
      <Fire tone={tone} d={440} />
    </div>
  ),
  // Someone at the lock, asking to be let in.
  access_requested: ({ tone }) => (
    <>
      <GlyphTile tone={tone} className="size-10">
        <LockGlyph aria-hidden />
        <Fire tone={tone} d={420} />
      </GlyphTile>
      <div
        className="ats-t ats-in relative flex shrink-0 items-center"
        style={at('none', 'translateX(12px)', 80)}
      >
        <span className="relative size-3.5">
          <Avatar who="MS" className="left-0 top-0" />
        </span>
        <CommentBubble inline className="ml-1" who={tone.dot}>
          <span
            className="ats-t ats-in ats-pop text-[7px] font-bold leading-none text-slate-600 dark:text-slate-200"
            style={at('none', 'scale(0.3)', 300)}
          >
            ?
          </span>
        </CommentBubble>
      </div>
    </>
  ),
  // A comment landing on the page.
  comment_added: ({ tone }) => (
    <div className="relative mt-3 shrink-0">
      <Page className="h-[40px] w-[68px]" />
      <CommentBubble
        className="ats-t ats-in ats-pop -top-3 left-2 origin-bottom-left"
        style={at('none', 'translateY(6px) scale(0.4)', 60)}
      />
      <Avatar who="JR" className="bottom-1 right-1" />
      <Fire tone={tone} d={400} className="-right-1.5 top-1" />
    </div>
  ),
  // One thread, ticked off.
  thread_resolved: ({ tone }) => (
    <div className="relative mt-3 shrink-0">
      <Page className="h-[40px] w-[68px]" />
      <CommentBubble className="-top-3 left-2" who="bg-sky-500">
        <span
          className="ats-t ats-in ats-pop ml-0.5 grid size-2.5 place-items-center rounded-full bg-emerald-500 text-white"
          style={at('none', 'scale(0.2)', 160)}
        >
          <CheckGlyph aria-hidden />
        </span>
      </CommentBubble>
      <Fire tone={tone} d={400} className="-right-1.5 top-1" />
    </div>
  ),
  // The last open thread on the tab, ticked: its count turns to All Done.
  threads_resolved: ({ tone }) => (
    <div className="relative mt-3 shrink-0">
      <Page className="h-[40px] w-[68px]" />
      <CommentBubble className="-top-3 left-2" who="bg-sky-500">
        <span
          className="ats-t ats-in ats-pop ml-0.5 grid size-2.5 place-items-center rounded-full bg-emerald-500 text-white"
          style={at('none', 'scale(0.2)', 160)}
        >
          <CheckGlyph aria-hidden />
        </span>
      </CommentBubble>
      <Chip className={`absolute bottom-1 right-1 ${tone.soft}`}>
        <span className="inline-grid">
          <span className="ats-out col-start-1 row-start-1" style={after(260)}>
            1 open
          </span>
          <span className="ats-in col-start-1 row-start-1" style={after(260)}>
            All done
          </span>
        </span>
      </Chip>
      <Fire tone={tone} d={460} className="-right-1.5 top-1" />
    </div>
  ),
  // An action getting its person.
  action_assigned: ({ tone }) => (
    <div className={`relative flex w-[88px] shrink-0 flex-col gap-[5px] p-1.5 ${PANEL}`}>
      <ActionRow tone={tone} ticked />
      <ActionRow tone={tone}>
        <span className="relative ml-auto size-3.5">
          <Avatar
            who="KP"
            className="ats-t ats-in ats-pop left-0 top-0"
            style={at('none', 'translate(10px, -8px) scale(0.3)', 120)}
          />
        </span>
      </ActionRow>
      <Fire tone={tone} d={420} />
    </div>
  ),
  // An action ticked done.
  action_done: ({ tone }) => (
    <div className={`relative flex w-[88px] shrink-0 flex-col gap-[5px] p-1.5 ${PANEL}`}>
      <ActionRow tone={tone} ticked />
      <ActionRow tone={tone} tick={160}>
        <span className="relative ml-auto size-3.5">
          <Avatar who="KP" className="left-0 top-0" />
        </span>
      </ActionRow>
      <Fire tone={tone} d={420} />
    </div>
  ),
};
