import { at } from '@/components/art-tokens';
import {
  ACCENT,
  ACCENT_INK,
  Avatar,
  Card,
  Check,
  FAINT,
  Handle,
  MUTED,
  PANEL,
  ROW,
  Txt,
  UpArrow,
  type Box,
  type Person,
} from './hero-townhall-parts';

// The Town Hall window's Q&A board (hero-townhall-board.tsx, docs/specs/012-collaboration/qa-board.md):
// the questions the room asks, the beats they move on, and the board that draws them. A question is
// typed and lands with three more, votes tick up, the most wanted rises to the top, and the host
// spotlights it (Now discussing), marks it done (it folds into Discussed) and spotlights the next.

/** What the board reads from a window's layout: its box, its row height and the question's text size. */
export type QaLayout = { board: Box; rowH: number; question: number };

const SAM: Person = { initials: 'SL', name: 'Sam Lee', colour: '#f59e0b' };
const ALEX: Person = { initials: 'AR', name: 'Alex Rivera', colour: '#10b981' };
const JO: Person = { initials: 'JO', name: 'Jo Okafor', colour: '#6366f1' };
const KIM: Person = { initials: 'KW', name: 'Kim Wu', colour: '#ef4444' };

type Question = { text: string; who: Person; ago: string; votes: [number, number]; d: number };
// In the order they land. The second gathers the most votes and rises to the top.
const QUESTIONS: Question[] = [
  { text: 'What is on the Q4 roadmap?', who: SAM, ago: '4m', votes: [2, 5], d: 1.3 },
  { text: 'Will Fridays stay meeting-free?', who: ALEX, ago: '3m', votes: [4, 21], d: 2.2 },
  { text: 'When does the EU launch land?', who: JO, ago: '2m', votes: [1, 12], d: 2.7 },
  { text: 'Is the team offsite on this year?', who: KIM, ago: '1m', votes: [1, 6], d: 3.2 },
];
const MAX_VOTES = 21;
// Where each settles once the votes are in (sorted by votes), and where it ends once the top one
// is discussed and folded away (-1: gone into Discussed).
const RANKED = [3, 0, 1, 2];
const AFTER_DONE = [2, -1, 0, 1];
const TOP = 1; // Fridays
const NEXT = 2; // the EU launch

// The beats, in seconds into the cycle.
const TYPE_AT = 1.5;
const VOTES_AT = 3.9;
const RISE_AT = 4.9;
const DISCUSS_AT = 6.4;
const DONE_AT = 8.9;
const SHIFT_AT = 9.1;
const NEXT_AT = 9.8;

// The board's rows start under its header.
export function rowY(board: Box, slot: number, rowH: number) {
  return board.y + 30 + slot * rowH;
}
export function rowCentre(board: Box, rowH: number, slot: number) {
  return rowY(board, slot, rowH) + (rowH - 6) / 2;
}

// The Q&A board element: its header, the queue of notes as vote rows, the spotlight, the Discussed
// drawer and the composer the room asks in.
export function QaBoard({ L }: { L: QaLayout }) {
  const box = L.board;
  const at0 = (slot: number) => rowY(box, slot, L.rowH);
  const x = box.x + 10;
  const w = box.w - 20;
  const h = L.rowH - 6;
  return (
    <>
      <g className="hm-pop" style={at(0.3)}>
        <Card box={box} rx={16} className={PANEL} />
        <Handle x={box.x + 14} y={box.y + 15} />
        <Txt x={box.x + 28} y={box.y + 18.5} size={10.5} weight={700} className={ACCENT_INK}>
          Questions for the panel
        </Txt>
        <Txt
          x={box.x + box.w - 14}
          y={box.y + 18}
          size={7}
          weight={600}
          anchor="end"
          className={MUTED}
          letterSpacing={0.6}
        >
          SORTED BY VOTES
        </Txt>
      </g>

      {QUESTIONS.map((q, i) => {
        const first = at0(i);
        const ranked = RANKED[i]!;
        const after = AFTER_DONE[i]!;
        const top = i === TOP;
        return (
          // Rises (or sinks) to its rank, then moves up a slot once the top one is folded away.
          <g
            key={q.text}
            className="hm-move"
            style={at(RISE_AT, { '--dy': `${(ranked - i) * L.rowH}px` })}
          >
            <g
              className={top ? 'hm-out' : 'hm-move'}
              style={top ? at(DONE_AT) : at(SHIFT_AT, { '--dy': `${(after - ranked) * L.rowH}px` })}
            >
              <g className="hm-pop" style={at(q.d)}>
                <Row q={q} x={x} y={first} w={w} h={h} size={L.question} i={i} />
              </g>
            </g>
          </g>
        );
      })}

      {/* The host's hover actions on the top row: Discuss Now, then Mark Done, then Discuss Now on
          the next. */}
      {[DISCUSS_AT - 0.55, DONE_AT - 0.5, NEXT_AT - 0.6].map((d, i) => (
        <RowActions key={d} x={x + w - 6} y={at0(0) + 6} d={d} pick={i === 1 ? 1 : 0} />
      ))}

      {/* Now discussing: the top note lifted into the spotlight, then folded away; the next follows. */}
      <g className="hm-out" style={at(DONE_AT)}>
        <Spotlight
          q={QUESTIONS[TOP]!}
          x={x}
          y={at0(0)}
          w={w}
          h={h}
          d={DISCUSS_AT}
          size={L.question}
        />
      </g>
      <Spotlight q={QUESTIONS[NEXT]!} x={x} y={at0(0)} w={w} h={h} d={NEXT_AT} size={L.question} />

      {/* Discussed: the closed note, folded away with its votes frozen. */}
      <g className="hm-pop" style={at(SHIFT_AT + 0.2)}>
        <rect x={x} y={at0(3) + 4} width={w} height="22" rx="8" className={ROW} />
        <circle cx={x + 13} cy={at0(3) + 15} r="6" fill="#22c55e" fillOpacity="0.18" />
        <Check
          x={x + 13}
          y={at0(3) + 15}
          className="stroke-green-600 dark:stroke-green-400"
          size={0.8}
        />
        <Txt x={x + 25} y={at0(3) + 18} size={8.5} weight={700} className={MUTED}>
          Discussed
        </Txt>
        <Txt x={x + 70} y={at0(3) + 18} size={8.5} className={FAINT}>
          · Will Fridays stay meeting-free?
        </Txt>
        <rect x={x + w - 26} y={at0(3) + 10} width="18" height="11" rx="5.5" className={ROW} />
        <Txt
          x={x + w - 17}
          y={at0(3) + 18}
          size={7.5}
          weight={700}
          anchor="middle"
          className={MUTED}
        >
          1
        </Txt>
      </g>

      <Composer box={box} />
    </>
  );
}

// A note in the queue: the vote pill, the question, who asked and when, and its heat bar.
function Row({
  q,
  x,
  y,
  w,
  h,
  size,
  i,
}: {
  q: Question;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  i: number;
}) {
  const tick = VOTES_AT + i * 0.18;
  const heat = q.votes[1] / MAX_VOTES;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="10" className={ROW} />
      {/* After the rise the top row wears the accent and "Most wanted". */}
      {i === TOP ? (
        <g className="hm-fade" style={at(RISE_AT + 0.5)}>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx="10"
            fill={ACCENT}
            fillOpacity="0.1"
            stroke={ACCENT}
            strokeOpacity="0.3"
          />
          <rect
            x={x + 48}
            y={y + 6}
            width="54"
            height="11"
            rx="5.5"
            fill={ACCENT}
            fillOpacity="0.16"
          />
          <Txt
            x={x + 75}
            y={y + 14}
            size={6.5}
            weight={800}
            anchor="middle"
            className={ACCENT_INK}
            letterSpacing={0.5}
          >
            MOST WANTED
          </Txt>
        </g>
      ) : null}
      <VotePill x={x + 7} y={y + 7} h={h - 14} votes={q.votes} tick={tick} />
      {i === TOP || i === NEXT ? (
        <Txt
          className="th-plus"
          style={at(tick)}
          x={x + 23}
          y={y + 8}
          size={8}
          weight={900}
          anchor="middle"
          fill={ACCENT}
        >
          +1
        </Txt>
      ) : null}
      <g
        className={i === TOP ? 'hm-move' : undefined}
        style={i === TOP ? at(RISE_AT + 0.5, { '--dy': '5px' }) : undefined}
      >
        <Txt x={x + 48} y={y + 20} size={size} weight={600}>
          {q.text}
        </Txt>
        <Avatar cx={x + 53} cy={y + 32.5} r={5} person={q.who} />
        <Txt x={x + 62} y={y + 35.5} size={8} className={MUTED}>
          {q.who.name} · {q.ago} ago
        </Txt>
      </g>
      {/* The heat bar: this note's share of the most-voted note's count. */}
      <rect
        className="hm-wipe"
        style={at(tick + 0.1)}
        x={x + 6}
        y={y + h - 2.5}
        width={(w - 12) * heat}
        height="2"
        rx="1"
        fill={ACCENT}
        fillOpacity={0.35 + heat * 0.65}
      />
    </>
  );
}

function VotePill({
  x,
  y,
  h,
  votes,
  tick,
}: {
  x: number;
  y: number;
  h: number;
  votes: [number, number];
  tick: number;
}) {
  const cx = x + 16;
  return (
    <>
      <rect
        x={x}
        y={y}
        width="32"
        height={h}
        rx="9"
        className="fill-white stroke-slate-900/10 dark:fill-slate-900 dark:stroke-white/10"
      />
      <UpArrow x={cx} y={y + 11} className="stroke-slate-500 dark:stroke-slate-400" />
      <Txt
        className={`hm-out fill-slate-700 dark:fill-slate-200`}
        style={at(tick)}
        x={cx}
        y={y + h - 7}
        size={10.5}
        weight={800}
        anchor="middle"
      >
        {votes[0]}
      </Txt>
      <Txt
        className={`hm-fade fill-slate-700 dark:fill-slate-200`}
        style={at(tick)}
        x={cx}
        y={y + h - 7}
        size={10.5}
        weight={800}
        anchor="middle"
      >
        {votes[1]}
      </Txt>
    </>
  );
}

// The host's round actions, shown while the pointer is on the row: Discuss Now (the accent) and
// Mark Done, on a solid pill in the board's own colour.
function RowActions({ x, y, d, pick }: { x: number; y: number; d: number; pick: number }) {
  return (
    <g className="th-blink" style={at(d)}>
      <rect
        x={x - 46}
        y={y - 2}
        width="46"
        height="22"
        rx="11"
        className="fill-white stroke-slate-900/10 dark:fill-slate-900 dark:stroke-white/10"
      />
      {[0, 1].map((k) => {
        const cx = x - 34 + k * 22;
        const on = k === pick;
        return (
          <g key={k}>
            <circle
              cx={cx}
              cy={y + 9}
              r="8"
              fill={k === 0 ? ACCENT : '#64748b'}
              fillOpacity={on ? 0.28 : 0.12}
            />
            {k === 0 ? (
              <path
                d={`M${cx - 3.5} ${y + 6} h7 M${cx - 3.5} ${y + 9} h7 M${cx - 3.5} ${y + 12} h4`}
                className="stroke-sky-600 dark:stroke-sky-300"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            ) : (
              <Check
                x={cx}
                y={y + 9}
                className="stroke-slate-600 dark:stroke-slate-300"
                size={0.8}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

// The spotlight: the note the room is discussing, ringed in the accent with its glow, "Now
// discussing" over it and its vote pill filled.
function Spotlight({
  q,
  x,
  y,
  w,
  h,
  d,
  size,
}: {
  q: Question;
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  size: number;
}) {
  return (
    // It fades up in place over the row it lifts, so the two never show doubled.
    <g className="hm-fade" style={at(d)}>
      <rect x={x - 2} y={y + 1} width={w + 4} height={h + 4} rx="12" fill={ACCENT} opacity="0.16" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="11"
        className="fill-white dark:fill-slate-900"
        stroke={ACCENT}
        strokeWidth="1.6"
      />
      <rect x={x + 7} y={y + 7} width="32" height={h - 14} rx="9" fill={ACCENT} />
      <UpArrow x={x + 23} y={y + 18} className="stroke-white" />
      <Txt
        x={x + 23}
        y={y + h - 14}
        size={10.5}
        weight={800}
        anchor="middle"
        className=""
        fill="white"
      >
        {q.votes[1]}
      </Txt>
      <circle className="hm-live" cx={x + 51} cy={y + 11} r="2.6" fill={ACCENT} />
      <Txt x={x + 57} y={y + 14} size={6.5} weight={800} className={ACCENT_INK} letterSpacing={0.9}>
        NOW DISCUSSING
      </Txt>
      <Txt x={x + 48} y={y + 28} size={size} weight={700}>
        {q.text}
      </Txt>
      <Avatar cx={x + 53} cy={y + 39} r={4.5} person={q.who} />
      <Txt x={x + 61} y={y + 41.8} size={7.5} className={MUTED}>
        {q.who.name} · {q.votes[1]} votes
      </Txt>
    </g>
  );
}

// The composer at the board's foot: a question typed and sent, the anonymous name it goes under.
function Composer({ box }: { box: Box }) {
  const x = box.x + 10;
  const w = box.w - 20;
  const y = box.y + box.h - 46;
  return (
    <g className="hm-pop" style={at(0.6)}>
      <rect
        x={x}
        y={y}
        width={w}
        height="38"
        rx="12"
        className="fill-white stroke-slate-900/10 dark:fill-slate-900 dark:stroke-white/10"
      />
      <g className="hm-out" style={at(TYPE_AT)}>
        <Txt x={x + 10} y={y + 15} size={9} className={FAINT}>
          Add a note…
        </Txt>
      </g>
      <g className="hm-out" style={at(QUESTIONS[TOP]!.d - 0.05)}>
        <Txt
          className="hm-type"
          style={at(TYPE_AT, { '--steps': 31 })}
          x={x + 10}
          y={y + 15}
          size={9}
        >
          Will Fridays stay meeting-free?
        </Txt>
      </g>
      <g className="hm-fade" style={at(QUESTIONS[TOP]!.d)}>
        <Txt x={x + 10} y={y + 15} size={9} className={FAINT}>
          Add a note…
        </Txt>
      </g>
      <circle cx={x + w - 14} cy={y + 13} r="8" fill={ACCENT} />
      <path
        d={`M${x + w - 14} ${y + 17} v-8 m-3.5 3.5 l3.5 -3.5 l3.5 3.5`}
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The anonymous toggle, on: the note goes in under a friendly made-up name. */}
      <rect x={x + 8} y={y + 24} width="16" height="9" rx="4.5" fill={ACCENT} />
      <circle cx={x + 19.5} cy={y + 28.5} r="3.3" fill="white" />
      <Txt x={x + 29} y={y + 31.5} size={7.5} weight={600} className={ACCENT_INK}>
        As Daring Seal
      </Txt>
    </g>
  );
}
