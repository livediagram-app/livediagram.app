'use client';

// The scenes of the templates on the later triggers: children done, unblocked, stuck cards, feedback resolved.
// Part of TemplateScene.tsx (docs/specs/026-plan/automations.md "The Automations screen": Templates).

import {
  after,
  at,
  Avatar,
  Card,
  CheckGlyph,
  Column,
  Count,
  FlagGlyph,
  MessageGlyph,
  NEXT_COLUMN,
  Pill,
  type ToneClasses,
} from '../scene-parts';

// A small child row on a parent card, ticked when done.
function ChildRow({ done, d }: { done: boolean; d?: number }) {
  return (
    <span className="flex h-[10px] items-center gap-1 rounded-[3px] bg-slate-50 px-1 dark:bg-slate-900/60">
      <span
        className={`grid size-[7px] shrink-0 place-items-center rounded-full ${done ? 'bg-emerald-500' : 'ring-1 ring-slate-300 dark:ring-slate-600'} ${d === undefined ? '' : 'ats-t ats-in ats-pop'}`}
        style={d === undefined ? undefined : at('none', 'scale(0.2)', d)}
      />
      <span className="h-[2px] w-3/5 rounded-full bg-slate-300 dark:bg-slate-600" />
    </span>
  );
}

export function CloseParent({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="In Progress" count={<Count from={1} to={0} d={620} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN, 'none', 520)}>
          <div className="relative flex flex-col gap-[3px] rounded-md bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.1),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-slate-800">
            <div className="h-1 w-4/5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <ChildRow done />
            <ChildRow done />
            <span className="relative">
              <ChildRow done={false} />
              <span className="absolute inset-0">
                <ChildRow done d={140} />
              </span>
            </span>
          </div>
        </div>
      </Column>
      <Column tone={tone} label="Done" count={<Count from={2} to={3} d={620} />}>
        <Card ghost wide="w-3/5" />
      </Column>
    </>
  );
}

export function TellUnblocked({ tone }: { tone: ToneClasses }) {
  return (
    <Column tone={tone} label="To Do" className="mx-[4%]">
      <Card>
        <Pill
          className="ats-out bottom-[3px] right-6 bg-red-100 text-red-700 shadow-none dark:bg-red-500/25 dark:text-red-100"
          style={after(200)}
        >
          Blocked
        </Pill>
        <Avatar who="JR" className="bottom-1 right-1" />
        <span
          className="ats-t ats-in ats-pop absolute -top-4 right-2 z-10 flex items-center gap-0.5 rounded-md rounded-br-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
          style={{
            ...at('none', 'translateY(6px) scale(0.4)', 380),
            transformOrigin: 'bottom right',
          }}
        >
          <span className={`rounded px-0.5 text-[6.5px] font-bold leading-[9px] ${tone.soft}`}>
            @JR
          </span>
          <span className="text-[6.5px] font-semibold leading-none text-slate-600 dark:text-slate-200">
            Ready to start
          </span>
        </span>
      </Card>
      <Card ghost wide="w-1/2" />
    </Column>
  );
}

export function NudgeStuck({ tone }: { tone: ToneClasses }) {
  return (
    <Column tone={tone} label="In Progress" className="mx-[4%]">
      <Card ghost wide="w-2/3" />
      <Card>
        <Pill className={`bottom-[3px] right-6 shadow-none ${tone.soft}`}>5 days</Pill>
        <Avatar who="MS" className="bottom-1 right-1" />
        <span
          className="ats-t ats-in ats-pop absolute -right-1 -top-1.5 grid size-3.5 place-items-center rounded bg-red-500 text-white"
          style={at('none', 'scale(0.3) rotate(-20deg)', 160)}
        >
          <FlagGlyph aria-hidden />
        </span>
        <span
          className="ats-t ats-in ats-pop absolute -top-4 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
          style={{
            ...at('none', 'translateY(6px) scale(0.4)', 400),
            transformOrigin: 'bottom left',
          }}
        >
          <span className={`rounded px-0.5 text-[6.5px] font-bold leading-[9px] ${tone.soft}`}>
            @MS
          </span>
          <span className="text-[6.5px] font-semibold leading-none text-slate-600 dark:text-slate-200">
            How is it going?
          </span>
        </span>
      </Card>
    </Column>
  );
}

export function DoneWhenResolved({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Review" count={<Count from={1} to={0} d={560} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN, 'none', 460)}>
          <Card>
            <span className="absolute bottom-1 right-1 inline-grid">
              <span className="col-start-1 row-start-1 flex items-center gap-0.5 text-[7px] font-bold text-slate-500 dark:text-slate-300">
                <MessageGlyph aria-hidden />1
              </span>
              <span
                className="ats-t ats-in ats-pop col-start-1 row-start-1 grid size-3 place-items-center rounded-full bg-emerald-500 text-white"
                style={at('none', 'scale(0.2)', 160)}
              >
                <CheckGlyph aria-hidden />
              </span>
            </span>
          </Card>
        </div>
      </Column>
      <Column tone={tone} label="Done" count={<Count from={1} to={2} d={560} />}>
        <Card ghost wide="w-3/5" />
      </Column>
    </>
  );
}
