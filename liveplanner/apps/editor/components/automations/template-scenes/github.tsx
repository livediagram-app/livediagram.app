'use client';

// The GitHub templates' scenes: a card's pull request pill turns state (opened, merged, closed, checks failing or
// passing), then the rule acts on the card. Part of TemplateScene.tsx (docs/specs/026-plan/automations.md "The
// Automations screen": Templates; "GitHub triggers").

import {
  at,
  Avatar,
  Card,
  CheckGlyph,
  Column,
  Count,
  FailGlyph,
  FlagGlyph,
  MessageGlyph,
  NEXT_COLUMN,
  PREV_COLUMN,
  Pill,
  PrClosedGlyph,
  PrDraftGlyph,
  PrMergedGlyph,
  PrOpenGlyph,
  PrTurn,
  SlackChannel,
  type PrFace,
  type ToneClasses,
} from '../scene-parts';

const DRAFT: PrFace = { pill: 'draft', Mark: PrDraftGlyph };
const OPEN: PrFace = { pill: 'open', Mark: PrOpenGlyph };
const MERGED: PrFace = { pill: 'merged', Mark: PrMergedGlyph };
const CLOSED: PrFace = { pill: 'closed', Mark: PrClosedGlyph };
// Open with its checks running (an amber dot), then failing (a cross, in red) or passing (a tick).
const RUNNING: PrFace = {
  ...OPEN,
  tail: <span aria-hidden className="ml-px size-1.5 rounded-full bg-amber-500" />,
};
const FAILING: PrFace = { pill: 'closed', Mark: PrOpenGlyph, tail: <FailGlyph aria-hidden /> };
const PASSING: PrFace = { ...OPEN, tail: <CheckGlyph aria-hidden /> };

// One card slot back to the column before: the card's width, the column's padding and border, and the gap.

// The pill turns first; then the rule moves the card.
const TURN = 120;
const MOVE = 420;

/** A comment or a mention popping above the card, after the rule acts. */
function Said({
  tone,
  who,
  text,
  d,
}: {
  tone: ToneClasses;
  who?: string;
  text: string;
  d: number;
}) {
  return (
    <span
      className="ats-t ats-in ats-pop absolute -top-4 left-1 z-10 flex items-center gap-0.5 rounded-md rounded-bl-none bg-white px-1 py-0.5 shadow-[0_3px_8px_-2px_rgba(15,23,42,0.35)] dark:bg-slate-700"
      style={{ ...at('none', 'translateY(6px) scale(0.4)', d), transformOrigin: 'bottom left' }}
    >
      {who ? (
        <span className={`rounded px-0.5 text-[6.5px] font-bold leading-[9px] ${tone.soft}`}>
          {who}
        </span>
      ) : (
        <span className={tone.label}>
          <MessageGlyph aria-hidden />
        </span>
      )}
      <span className="text-[6.5px] font-semibold leading-none text-slate-600 dark:text-slate-200">
        {text}
      </span>
    </span>
  );
}

export function ReviewOnOpen({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="In Progress" count={<Count from={2} to={1} d={MOVE + 200} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN, 'none', MOVE)}>
          <Card>
            <PrTurn from={DRAFT} to={OPEN} d={TURN} />
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="Review" count={<Count from={1} to={2} d={MOVE + 200} />}>
        <div className="h-[26px] shrink-0" />
        <Card ghost wide="w-2/3" />
      </Column>
    </>
  );
}

export function DoneOnMerge({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Review" count={<Count from={2} to={1} d={MOVE + 200} />}>
        <div className="ats-t ats-drag relative z-10" style={at(NEXT_COLUMN, 'none', MOVE)}>
          <Card>
            <PrTurn from={OPEN} to={MERGED} d={TURN} />
            <Pill
              className={`ats-t ats-in ats-pop -top-2 right-1 ${tone.solid}`}
              style={at('none', 'scale(0.3) rotate(-12deg)', MOVE + 380)}
            >
              <CheckGlyph aria-hidden />
              Today
            </Pill>
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
      <Column tone={tone} label="Done" count={<Count from={3} to={4} d={MOVE + 200} />}>
        <div className="h-[26px] shrink-0" />
        <Card ghost wide="w-2/3" />
      </Column>
    </>
  );
}

export function FlagFailingChecks({ tone }: { tone: ToneClasses }) {
  return (
    <Column tone={tone} label="Review" className="mx-[4%]">
      <Card ghost wide="w-2/3" />
      <Card>
        <PrTurn from={RUNNING} to={FAILING} d={TURN} className="bottom-[3px] right-6" />
        <Avatar who="KP" className="bottom-1 right-1" />
        <span
          className="ats-t ats-in ats-pop absolute -right-1 -top-1.5 grid size-3.5 place-items-center rounded bg-red-500 text-white"
          style={at('none', 'scale(0.3) rotate(-20deg)', 360)}
        >
          <FlagGlyph aria-hidden />
        </span>
        <Said tone={tone} text="Checks are failing" d={560} />
      </Card>
    </Column>
  );
}

export function TellChecksPass({ tone }: { tone: ToneClasses }) {
  return (
    <Column tone={tone} label="Review" className="mx-[4%]">
      <Card ghost wide="w-2/3" />
      <Card>
        <PrTurn from={RUNNING} to={PASSING} d={TURN} className="bottom-[3px] right-6" />
        <Avatar who="MS" className="bottom-1 right-1" />
        <span
          className="ats-t ats-out absolute -right-1 -top-1.5 grid size-3.5 place-items-center rounded bg-red-500 text-white"
          style={at('none', 'translate(3px, -6px) rotate(30deg) scale(0.6)', 360)}
        >
          <FlagGlyph aria-hidden />
        </span>
        <Said tone={tone} who="@MS" text="Checks pass" d={560} />
      </Card>
    </Column>
  );
}

export function BackOnClose({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="In Progress" count={<Count from={1} to={2} d={MOVE + 200} />}>
        <div className="h-[26px] shrink-0" />
        <Card ghost wide="w-2/3" />
      </Column>
      <Column tone={tone} label="Review" count={<Count from={2} to={1} d={MOVE + 200} />}>
        <div className="ats-t ats-drag relative z-10" style={at(PREV_COLUMN, 'none', MOVE)}>
          <Card>
            <PrTurn from={OPEN} to={CLOSED} d={TURN} />
            <Said tone={tone} text="Closed" d={MOVE + 420} />
          </Card>
        </div>
        <Card ghost wide="w-3/5" />
      </Column>
    </>
  );
}

export function MergedToSlack({ tone }: { tone: ToneClasses }) {
  return (
    <>
      <Column tone={tone} label="Review" className="w-[40%] flex-none">
        <Card>
          <PrTurn from={OPEN} to={MERGED} d={TURN} />
        </Card>
        <Card ghost wide="w-3/5" />
      </Column>
      <SlackChannel tone={tone} channel="releases" d={MOVE} />
    </>
  );
}
