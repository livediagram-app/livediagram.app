import type { CSSProperties, ReactNode } from 'react';

// The hero's Town Hall window (docs/specs/019-marketing/marketing-site.md "Hero"): the app's Town Hall
// Q&A template (packages/templates template-builders-town-hall.ts) running live. On the left the panel
// and the run of show, its open Q&A segment live; in the middle the Q&A board
// (docs/specs/012-collaboration/qa-board.md): questions land, votes tick up, the most-voted rises, is
// answered, and is marked done; on the right the facilitator's kit: the Q&A timer counting down,
// the applause pad the room's reactions float from, a "How useful was this?" poll filling in, and
// the follow-ups the panel owes ticking off. A phone stacks the panel, the board and the kit. Each
// piece arrives at its own --d delay (hero-mode-animations.css).

const FONT = 'ui-sans-serif, system-ui, sans-serif';
const BRAND = '#0ea5e9';
const MUTED = '#64748b';
const CARD = 'fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
const INSET = 'fill-slate-50 stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700';
const INK = 'fill-slate-800 dark:fill-slate-100';

const at = (d: number, extra?: Record<string, string | number>) =>
  ({ '--d': `${d}s`, ...extra }) as CSSProperties;

const PANEL = [
  { initials: 'MC', name: 'Maya Chen', role: 'CEO · hosting', colour: '#7c3aed' },
  { initials: 'DP', name: 'Dev Patel', role: 'CFO · the numbers', colour: '#0891b2' },
  { initials: 'PN', name: 'Priya Nair', role: 'Product · roadmap', colour: '#db2777' },
];
const AGENDA = [
  { label: 'Welcome', mins: 5 },
  { label: 'The quarter in numbers', mins: 10 },
  { label: 'What we ship next', mins: 10 },
  { label: 'Open Q&A', mins: 30, live: true },
  { label: 'Wrap-up', mins: 5 },
];
type Question = { text: string; who: string; votes: [number, number]; d: number };
// In the order they arrive. The second gathers the most votes and rises to the top.
const QUESTIONS: Question[] = [
  { text: 'What is on the Q4 roadmap?', who: 'Sam', votes: [3, 5], d: 1.4 },
  { text: 'Will Fridays stay meeting-free?', who: 'Alex', votes: [4, 21], d: 2.0 },
  { text: 'When does the EU launch land?', who: 'Jo', votes: [2, 8], d: 2.6 },
  { text: 'Team offsite this year?', who: 'Kim', votes: [1, 6], d: 3.2 },
];
const POLL = [1, 2, 4, 9, 12];
const FOLLOW_UPS = [
  'Share the Q4 roadmap · Priya',
  'Offsite dates · Maya',
  'EU pricing note · Dev',
];

const VOTES_AT = 4.2;
const RISE_AT = 5.4;
const ANSWERING_AT = 6.4;
const ANSWERED_AT = 8.4;

type Box = { x: number; y: number; w: number; h: number };
type Layout = {
  title: { x: number; y: number };
  panel: Box;
  agenda?: Box;
  board: Box;
  rowH: number;
  timer: Box;
  applause: Box;
  poll: Box;
  followUps?: Box;
};

// Three columns on a wide window, as the template lays them out; a phone stacks them.
const LANDSCAPE: Layout = {
  title: { x: 14, y: -38 },
  panel: { x: 14, y: -14, w: 170, h: 116 },
  agenda: { x: 14, y: 112, w: 170, h: 176 },
  board: { x: 196, y: -14, w: 214, h: 302 },
  rowH: 62,
  timer: { x: 422, y: -14, w: 164, h: 42 },
  applause: { x: 422, y: 36, w: 164, h: 42 },
  poll: { x: 422, y: 86, w: 164, h: 96 },
  followUps: { x: 422, y: 190, w: 164, h: 98 },
};
const PORTRAIT: Layout = {
  title: { x: 14, y: -22 },
  panel: { x: 14, y: -6, w: 332, h: 48 },
  board: { x: 14, y: 52, w: 332, h: 268 },
  rowH: 54,
  timer: { x: 14, y: 330, w: 160, h: 42 },
  applause: { x: 186, y: 330, w: 160, h: 42 },
  poll: { x: 14, y: 382, w: 332, h: 88 },
};

function Label({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <text
      x={x}
      y={y}
      fontFamily={FONT}
      fontSize="7.5"
      fontWeight="800"
      letterSpacing="1"
      fill={MUTED}
    >
      {children}
    </text>
  );
}

export function TownHallBoard({ portrait = false }: { portrait?: boolean }) {
  const L = portrait ? PORTRAIT : LANDSCAPE;
  return (
    <>
      {/* The session's heading. */}
      <g className="hm-pop" style={at(0.1)}>
        <text
          x={L.title.x}
          y={L.title.y}
          fontFamily={FONT}
          fontSize="14"
          fontWeight="800"
          className={INK}
        >
          🎙 Q3 all-hands · Town hall
        </text>
      </g>

      <Panel box={L.panel} portrait={portrait} />
      {L.agenda ? <Agenda box={L.agenda} /> : null}
      <Board box={L.board} rowH={L.rowH} portrait={portrait} />
      <Timer box={L.timer} />
      <Applause box={L.applause} />
      <Poll box={L.poll} />
      {L.followUps ? <FollowUps box={L.followUps} /> : null}
    </>
  );
}

// On the panel: who is answering, each with an initials disc. A phone shows the discs in a row.
function Panel({ box, portrait }: { box: Box; portrait: boolean }) {
  if (portrait) {
    return (
      <g className="hm-pop" style={at(0.4)}>
        <Label x={box.x} y={box.y + 8}>
          ON THE PANEL
        </Label>
        {PANEL.map((p, i) => (
          <g key={p.initials}>
            <circle cx={box.x + 14 + i * 110} cy={box.y + 30} r="12" fill={p.colour} />
            <text
              x={box.x + 14 + i * 110}
              y={box.y + 33.5}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="8.5"
              fontWeight="800"
              fill="white"
            >
              {p.initials}
            </text>
            <text
              x={box.x + 32 + i * 110}
              y={box.y + 34}
              fontFamily={FONT}
              fontSize="9.5"
              fontWeight="700"
              className={INK}
            >
              {p.name.split(' ')[0]}
            </text>
          </g>
        ))}
      </g>
    );
  }
  return (
    <g className="hm-pop" style={at(0.4)}>
      <Label x={box.x} y={box.y + 6}>
        ON THE PANEL
      </Label>
      {PANEL.map((p, i) => {
        const y = box.y + 14 + i * 34;
        return (
          <g key={p.initials}>
            <rect x={box.x} y={y} width={box.w} height="28" rx="7" className={CARD} />
            <circle cx={box.x + 15} cy={y + 14} r="9" fill={p.colour} />
            <text
              x={box.x + 15}
              y={y + 17}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="7"
              fontWeight="800"
              fill="white"
            >
              {p.initials}
            </text>
            <text
              x={box.x + 30}
              y={y + 12}
              fontFamily={FONT}
              fontSize="8.5"
              fontWeight="700"
              className={INK}
            >
              {p.name}
            </text>
            <text x={box.x + 30} y={y + 22} fontFamily={FONT} fontSize="7" fill={MUTED}>
              {p.role}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// Run of show: the segments and their minutes, the open Q&A live with its progress filling.
function Agenda({ box }: { box: Box }) {
  return (
    <g className="hm-pop" style={at(0.7)}>
      <Label x={box.x} y={box.y + 6}>
        RUN OF SHOW
      </Label>
      <rect x={box.x} y={box.y + 12} width={box.w} height={box.h - 12} rx="9" className={CARD} />
      {AGENDA.map((a, i) => {
        const y = box.y + 22 + i * 31;
        return (
          <g key={a.label}>
            {a.live ? (
              <rect
                x={box.x + 6}
                y={y - 4}
                width={box.w - 12}
                height="27"
                rx="6"
                className="fill-sky-100 dark:fill-sky-500/20"
              />
            ) : null}
            <text
              x={box.x + 14}
              y={y + 10}
              fontFamily={FONT}
              fontSize="8"
              fontWeight={a.live ? 800 : 600}
              className={a.live ? 'fill-sky-700 dark:fill-sky-300' : INK}
            >
              {a.label}
            </text>
            <text
              x={box.x + box.w - 14}
              y={y + 10}
              textAnchor="end"
              fontFamily={FONT}
              fontSize="7.5"
              fill={MUTED}
            >
              {a.mins}m
            </text>
            {a.live ? (
              <>
                <rect
                  x={box.x + 14}
                  y={y + 15}
                  width={box.w - 28}
                  height="3"
                  rx="1.5"
                  fill="#bae6fd"
                />
                <rect
                  className="hm-wipe"
                  style={at(1.2)}
                  x={box.x + 14}
                  y={y + 15}
                  width={(box.w - 28) * 0.4}
                  height="3"
                  rx="1.5"
                  fill={BRAND}
                />
              </>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

// The Q&A board itself.
function Board({ box, rowH, portrait }: { box: Box; rowH: number; portrait: boolean }) {
  const finalSlot = [1, 0, 2, 3];
  const right = box.x + box.w;
  const rowY = (i: number) => box.y + 34 + i * rowH;
  return (
    <>
      <g className="hm-pop" style={at(0.3)}>
        <rect
          x={box.x + 2}
          y={box.y + 3}
          width={box.w}
          height={box.h}
          rx="12"
          fill="#0f172a"
          opacity="0.06"
        />
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="12" className={CARD} />
        <text
          x={box.x + 12}
          y={box.y + 20}
          fontFamily={FONT}
          fontSize="10"
          fontWeight="800"
          className={INK}
        >
          Questions for the panel
        </text>
        <rect x={right - 46} y={box.y + 9} width="36" height="15" rx="7.5" fill="#fee2e2" />
        <circle className="hm-live" cx={right - 38} cy={box.y + 16.5} r="2.8" fill="#ef4444" />
        <text
          x={right - 32}
          y={box.y + 20}
          fontFamily={FONT}
          fontSize="7.5"
          fontWeight="800"
          fill="#b91c1c"
        >
          LIVE
        </text>
      </g>
      {QUESTIONS.map((q, i) => {
        const y = rowY(i);
        const dy = (finalSlot[i]! - i) * rowH;
        const top = finalSlot[i] === 0;
        const h = rowH - 8;
        return (
          <g key={q.text} className="hm-move" style={at(RISE_AT, { '--dy': `${dy}px` })}>
            <g className="hm-pop" style={at(q.d)}>
              <rect x={box.x + 8} y={y} width={box.w - 16} height={h} rx="9" className={INSET} />
              <rect x={box.x + 14} y={y + 7} width="26" height={h - 14} rx="6" className={CARD} />
              <path
                d={`M${box.x + 22} ${y + 17} l5 -5 l5 5`}
                fill="none"
                stroke={BRAND}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text
                className={`hm-out ${INK}`}
                style={at(VOTES_AT + i * 0.2)}
                x={box.x + 27}
                y={y + h - 11}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize="9"
                fontWeight="800"
              >
                {q.votes[0]}
              </text>
              <text
                className={`hm-fade ${top ? '' : INK}`}
                style={at(VOTES_AT + i * 0.2)}
                x={box.x + 27}
                y={y + h - 11}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize="9"
                fontWeight="800"
                fill={top ? BRAND : undefined}
              >
                {q.votes[1]}
              </text>
              <text
                x={box.x + 48}
                y={y + 17}
                fontFamily={FONT}
                fontSize={portrait ? 10 : 9}
                fontWeight="700"
                className={INK}
              >
                {q.text}
              </text>
              <text x={box.x + 48} y={y + 30} fontFamily={FONT} fontSize="7.5" fill={MUTED}>
                {q.who}
              </text>
            </g>
            {top ? (
              <>
                <rect
                  className="hm-fade"
                  style={at(ANSWERING_AT)}
                  x={box.x + 8}
                  y={y}
                  width={box.w - 16}
                  height={h}
                  rx="9"
                  fill="none"
                  stroke={BRAND}
                  strokeWidth="2"
                />
                <g className="hm-select" style={at(ANSWERING_AT)}>
                  <rect
                    x={box.x + 48}
                    y={y + h - 15}
                    width="68"
                    height="13"
                    rx="6.5"
                    fill="#e0f2fe"
                  />
                  <text
                    x={box.x + 82}
                    y={y + h - 6}
                    textAnchor="middle"
                    fontFamily={FONT}
                    fontSize="7"
                    fontWeight="800"
                    fill="#0369a1"
                  >
                    Answering now
                  </text>
                </g>
                <g className="hm-pop" style={at(ANSWERED_AT)}>
                  <rect
                    x={box.x + 48}
                    y={y + h - 15}
                    width="60"
                    height="13"
                    rx="6.5"
                    fill="#dcfce7"
                  />
                  <text
                    x={box.x + 78}
                    y={y + h - 6}
                    textAnchor="middle"
                    fontFamily={FONT}
                    fontSize="7"
                    fontWeight="800"
                    fill="#15803d"
                  >
                    ✓ Answered
                  </text>
                </g>
              </>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

// The Q&A timer: 30 minutes, counting down once the Q&A opens.
function Timer({ box }: { box: Box }) {
  return (
    <g className="hm-pop" style={at(0.9)}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" className={CARD} />
      <circle cx={box.x + 21} cy={box.y + box.h / 2} r="11" fill="#fef3c7" />
      <path
        d={`M${box.x + 21} ${box.y + box.h / 2 - 5} v5 l3.5 2.5`}
        fill="none"
        stroke="#d97706"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <text x={box.x + 40} y={box.y + 16} fontFamily={FONT} fontSize="7.5" fill={MUTED}>
        Q&amp;A timer
      </text>
      <text
        className={`hm-out ${INK}`}
        style={at(2.4)}
        x={box.x + 40}
        y={box.y + 32}
        fontFamily={FONT}
        fontSize="13"
        fontWeight="800"
      >
        30:00
      </text>
      <text
        className={`hm-fade ${INK}`}
        style={at(2.4)}
        x={box.x + 40}
        y={box.y + 32}
        fontFamily={FONT}
        fontSize="13"
        fontWeight="800"
      >
        18:42
      </text>
    </g>
  );
}

// The applause pad: the room's reactions float up from it.
function Applause({ box }: { box: Box }) {
  const reactions = [
    { e: '👏', d: 4.8, dx: 0 },
    { e: '🎉', d: 5.6, dx: 22 },
    { e: '❤️', d: 7.0, dx: -18 },
    { e: '👏', d: 8.8, dx: 10 },
    { e: '🙌', d: 9.6, dx: -8 },
  ];
  const cx = box.x + box.w / 2;
  return (
    <>
      <g className="hm-pop" style={at(1.1)}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" className={CARD} />
        <text x={box.x + 14} y={box.y + box.h / 2 + 6} fontSize="16">
          👏
        </text>
        <text x={box.x + 40} y={box.y + 16} fontFamily={FONT} fontSize="7.5" fill={MUTED}>
          Applause
        </text>
        <text
          className={`hm-out ${INK}`}
          style={at(6)}
          x={box.x + 40}
          y={box.y + 32}
          fontFamily={FONT}
          fontSize="13"
          fontWeight="800"
        >
          12
        </text>
        <text
          className={`hm-fade ${INK}`}
          style={at(6)}
          x={box.x + 40}
          y={box.y + 32}
          fontFamily={FONT}
          fontSize="13"
          fontWeight="800"
        >
          64
        </text>
      </g>
      {reactions.map((r, i) => (
        <text
          key={i}
          className="hm-float"
          style={at(r.d)}
          x={cx + 30 + r.dx}
          y={box.y + 18}
          fontSize="15"
          textAnchor="middle"
        >
          {r.e}
        </text>
      ))}
    </>
  );
}

// The closing poll: how useful was this, 1 to 5, the votes filling in.
function Poll({ box }: { box: Box }) {
  const max = Math.max(...POLL);
  const barsTop = box.y + 26;
  const barsH = box.h - 42;
  const gap = 8;
  const barW = (box.w - 28 - gap * (POLL.length - 1)) / POLL.length;
  return (
    <g className="hm-pop" style={at(1.3)}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" className={CARD} />
      <text
        x={box.x + 14}
        y={box.y + 16}
        fontFamily={FONT}
        fontSize="8.5"
        fontWeight="800"
        className={INK}
      >
        How useful was this?
      </text>
      {POLL.map((n, i) => {
        const h = (n / max) * barsH;
        const x = box.x + 14 + i * (barW + gap);
        return (
          <g key={i}>
            <rect
              className="hm-grow"
              style={at(7.4 + i * 0.12)}
              x={x}
              y={barsTop + barsH - h}
              width={barW}
              height={h}
              rx="3"
              fill={i === POLL.length - 1 ? BRAND : '#bae6fd'}
            />
            <text
              x={x + barW / 2}
              y={box.y + box.h - 6}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize="7"
              fill={MUTED}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// What the panel owes the room, ticking off.
function FollowUps({ box }: { box: Box }) {
  return (
    <g className="hm-pop" style={at(1.5)}>
      <Label x={box.x} y={box.y + 6}>
        FOLLOW-UPS
      </Label>
      <rect x={box.x} y={box.y + 12} width={box.w} height={box.h - 12} rx="10" className={CARD} />
      {FOLLOW_UPS.map((f, i) => {
        const y = box.y + 30 + i * 22;
        return (
          <g key={f}>
            <rect x={box.x + 12} y={y - 8} width="11" height="11" rx="3" className={INSET} />
            {i < 2 ? (
              <path
                className="hm-draw"
                style={at(9.2 + i * 0.4, { '--dur': '0.25s', '--len': 14 })}
                d={`M${box.x + 14.5} ${y - 2.5} l2.5 2.5 l4.5 -5`}
                fill="none"
                stroke="#16a34a"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            <text x={box.x + 30} y={y + 1} fontFamily={FONT} fontSize="7.5" className={INK}>
              {f}
            </text>
          </g>
        );
      })}
    </g>
  );
}
