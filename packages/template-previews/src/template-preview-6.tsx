import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { Pop, PopDot } from './story-parts';

// Group 6: the retro formats (Start / Stop / Continue, Mad / Sad / Glad, 4Ls
// and the Sailboat). Each is a miniature of its template: the shared opening
// rail on the left (mood card over the timer + vote buttons), the format's
// own board, and the owned actions. Hover stories run the ritual: the room
// answers the mood check, dots land on a note, an action gets ticked.

const SLATE = 'rgb(148 163 184)';
const INK = 'rgb(100 116 139)';
const TICK = 'rgb(22 163 74)';
const DOT = 'rgb(79 70 229)';

type Hue = { fill: string; stroke: string; note: string; deep: string };
const HUE = {
  green: {
    fill: 'rgb(220 252 231)',
    stroke: 'rgb(134 239 172)',
    note: 'rgb(187 247 208)',
    deep: 'rgb(22 163 74)',
  },
  rose: {
    fill: 'rgb(255 228 230)',
    stroke: 'rgb(253 164 175)',
    note: 'rgb(254 205 211)',
    deep: 'rgb(225 29 72)',
  },
  sky: {
    fill: 'rgb(224 242 254)',
    stroke: 'rgb(125 211 252)',
    note: 'rgb(186 230 253)',
    deep: 'rgb(2 132 199)',
  },
  orange: {
    fill: 'rgb(255 237 213)',
    stroke: 'rgb(253 186 116)',
    note: 'rgb(254 215 170)',
    deep: 'rgb(194 65 12)',
  },
  blue: {
    fill: 'rgb(219 234 254)',
    stroke: 'rgb(147 197 253)',
    note: 'rgb(191 219 254)',
    deep: 'rgb(29 78 216)',
  },
  lime: {
    fill: 'rgb(236 252 203)',
    stroke: 'rgb(190 242 100)',
    note: 'rgb(217 249 157)',
    deep: 'rgb(77 124 15)',
  },
  amber: {
    fill: 'rgb(254 243 199)',
    stroke: 'rgb(252 211 77)',
    note: 'rgb(253 230 138)',
    deep: 'rgb(180 83 9)',
  },
  violet: {
    fill: 'rgb(237 233 254)',
    stroke: 'rgb(196 181 253)',
    note: 'rgb(233 213 255)',
    deep: 'rgb(109 40 217)',
  },
  teal: {
    fill: 'rgb(204 251 241)',
    stroke: 'rgb(94 234 212)',
    note: 'rgb(153 246 228)',
    deep: 'rgb(15 118 110)',
  },
  slate: {
    fill: 'rgb(226 232 240)',
    stroke: 'rgb(148 163 184)',
    note: 'rgb(203 213 225)',
    deep: 'rgb(51 65 85)',
  },
} satisfies Record<string, Hue>;

// The mood card (five face rings over their bars). The hover story grows the
// room's answers up from the baseline.
function MoodCard({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const step = (w - 3) / 5;
  const base = y + h - 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1.5"
        fill="white"
        stroke={SLATE}
        strokeWidth="0.6"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={x + 1.5 + step * (i + 0.5)}
          cy={y + 3.2}
          r={Math.min(0.9, step / 2 - 0.2)}
          fill="none"
          stroke={INK}
          strokeWidth="0.5"
        />
      ))}
      {[
        { i: 1, v: 0.35, at: 700 },
        { i: 2, v: 0.6, at: 800 },
        { i: 3, v: 0.9, at: 900 },
        { i: 4, v: 0.5, at: 1000 },
      ].map((b) => (
        <rect
          key={b.i}
          className="pv-grow-y"
          opacity="0"
          x={x + 1.5 + step * b.i + step / 2 - 0.9}
          y={base - (h - 7) * b.v}
          width="1.8"
          height={(h - 7) * b.v}
          rx="0.4"
          fill="rgb(56 189 248)"
          style={pv({ '--pv-at': `${b.at}ms` })}
        />
      ))}
    </g>
  );
}

// The timer and vote buttons side by side.
function Buttons({ x, y, w }: { x: number; y: number; w: number }) {
  const bw = (w - 1) / 2;
  return (
    <g>
      {[x, x + bw + 1].map((bx, i) => (
        <g key={bx}>
          <rect
            x={bx}
            y={y}
            width={bw}
            height="5.5"
            rx="1"
            fill="white"
            stroke={SLATE}
            strokeWidth="0.6"
          />
          {i === 0 ? (
            <line
              x1={bx + 1.5}
              y1={y + 2.75}
              x2={bx + bw - 1.5}
              y2={y + 2.75}
              stroke={INK}
              strokeWidth="0.6"
            />
          ) : (
            <circle
              cx={bx + bw / 2}
              cy={y + 2.75}
              r="1.3"
              fill="none"
              stroke={INK}
              strokeWidth="0.5"
            />
          )}
        </g>
      ))}
    </g>
  );
}

// A tinted column with a stack of notes in its hue.
function Column({
  x,
  y,
  w,
  h,
  hue,
  notes,
  noteTop,
  cols = 1,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  hue: Hue;
  notes: number;
  noteTop: number;
  cols?: number;
}) {
  const gap = 1.2;
  const rows = Math.ceil(notes / cols);
  const nh = (y + h - 1.5 - noteTop - gap * (rows - 1)) / rows;
  const nw = (w - 2.6 - gap * (cols - 1)) / cols;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1.5"
        fill={hue.fill}
        stroke={hue.stroke}
        strokeWidth="0.6"
      />
      {Array.from({ length: notes }, (_, i) => (
        <rect
          key={i}
          x={x + 1.3 + (i % cols) * (nw + gap)}
          y={noteTop + Math.floor(i / cols) * (nh + gap)}
          width={nw}
          height={nh}
          rx="0.4"
          fill={hue.note}
        />
      ))}
    </g>
  );
}

// The neutral Action items paper with checklist rows.
function Actions({
  x,
  y,
  w,
  h,
  rows,
  rowTop,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rows: number;
  rowTop: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="1.5"
        fill="rgb(248 250 252)"
        stroke={SLATE}
        strokeWidth="1"
      />
      <rect x={x + 1.5} y={y + 2.5} width={w * 0.55} height="1.6" rx="0.4" fill="rgb(15 23 42)" />
      {Array.from({ length: rows }, (_, i) => (
        <g key={i}>
          <rect
            x={x + 1.5}
            y={rowTop + i * 4}
            width="2.4"
            height="2.4"
            rx="0.4"
            fill="white"
            stroke={INK}
            strokeWidth="0.45"
          />
          <line
            x1={x + 5}
            y1={rowTop + i * 4 + 1.2}
            x2={x + w - 1.5}
            y2={rowTop + i * 4 + 1.2}
            stroke={SLATE}
            strokeWidth="0.6"
          />
        </g>
      ))}
    </g>
  );
}

// A tick drawn into a checklist box at (x, y) as the story's last beat.
function Tick({ x, y, at }: { x: number; y: number; at: number }) {
  return (
    <path
      className="pv-new"
      opacity="0"
      d={`M${x + 0.5} ${y + 1.2} L${x + 1.3} ${y + 2} L${x + 2.1} ${y + 0.5}`}
      fill="none"
      stroke={TICK}
      strokeWidth="0.6"
      style={pv({ '--pv-at': `${at}ms` })}
    />
  );
}

// Three vote dots landing on a note, one after another.
function Dots({ cx, cy, from }: { cx: number; cy: number; from: number }) {
  return (
    <>
      {[-2.6, 0, 2.6].map((dx, i) => (
        <PopDot key={dx} at={from + i * 200} cx={cx + dx} cy={cy} r="1.1" fill={DOT} />
      ))}
    </>
  );
}

function StartStopContinue() {
  const cols = [
    { x: 17, hue: HUE.green, lamp: 'play' },
    { x: 32.5, hue: HUE.rose, lamp: 'stop' },
    { x: 48, hue: HUE.sky, lamp: 'repeat' },
  ];
  return (
    <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
      <MoodCard x={2} y={4} w={13} h={24} />
      <Buttons x={2} y={30} w={13} />
      {cols.map((c) => (
        <g key={c.x}>
          <Column x={c.x} y={4} w={14} h={42} hue={c.hue} notes={6} cols={2} noteTop={12} />
          {/* The lamp: a solid disc in the column's hue with its glyph. */}
          <circle
            cx={c.x + 3.4}
            cy="7.6"
            r="2.3"
            fill={c.hue.deep}
            className={c.lamp === 'stop' ? 'pv-pulse' : undefined}
            style={c.lamp === 'stop' ? pv({ '--pv-at': '1300ms' }) : undefined}
          />
          {c.lamp === 'play' ? (
            <path d={`M${c.x + 2.7} 6.5 L${c.x + 4.6} 7.6 L${c.x + 2.7} 8.7 Z`} fill="white" />
          ) : c.lamp === 'stop' ? (
            <rect x={c.x + 2.5} y="6.7" width="1.8" height="1.8" rx="0.2" fill="white" />
          ) : (
            <path
              d={`M${c.x + 2.2} 7.6 A1.2 1.2 0 1 1 ${c.x + 3.4} 8.8`}
              fill="none"
              stroke="white"
              strokeWidth="0.5"
            />
          )}
          <rect x={c.x + 6.6} y="6.8" width="5.5" height="1.6" rx="0.4" fill={c.hue.deep} />
        </g>
      ))}
      <Actions x={63.5} y={4} w={14.5} h={42} rows={4} rowTop={9} />
      {/* From Sprint 21: two done, one carried over. */}
      <rect x={65} y={24} width="7" height="1.4" rx="0.4" fill="rgb(15 23 42)" />
      {[28, 32, 36].map((ry, i) => (
        <g key={ry}>
          <rect
            x={65}
            y={ry}
            width="2.4"
            height="2.4"
            rx="0.4"
            fill={i < 2 ? 'rgb(14 165 233)' : 'white'}
            stroke={i < 2 ? 'rgb(14 165 233)' : INK}
            strokeWidth="0.45"
          />
          <line x1={68.5} y1={ry + 1.2} x2={76.5} y2={ry + 1.2} stroke={SLATE} strokeWidth="0.6" />
        </g>
      ))}
      {/* Hover story: the mood bars rise, three dots land on a Stop note,
          the Stop lamp flashes, and its action gets ticked. */}
      <Dots cx={39.5} cy={20.5} from={1500} />
      <Tick x={65} y={9} at={2300} />
    </svg>
  );
}

// An emoji face: a disc with two eyes and a mouth whose curve carries the mood.
function Face({
  cx,
  cy,
  fill,
  mood,
}: {
  cx: number;
  cy: number;
  fill: string;
  mood: 'mad' | 'sad' | 'glad';
}) {
  const mouth =
    mood === 'glad'
      ? `M${cx - 1.3} ${cy + 0.7} Q${cx} ${cy + 2.1} ${cx + 1.3} ${cy + 0.7}`
      : mood === 'sad'
        ? `M${cx - 1.2} ${cy + 1.7} Q${cx} ${cy + 0.6} ${cx + 1.2} ${cy + 1.7}`
        : `M${cx - 1.2} ${cy + 1.4} L${cx + 1.2} ${cy + 1.4}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r="3" fill={fill} />
      <circle cx={cx - 1} cy={cy - 0.6} r="0.4" fill="rgb(69 26 3)" />
      <circle cx={cx + 1} cy={cy - 0.6} r="0.4" fill="rgb(69 26 3)" />
      {mood === 'mad' ? (
        <path
          d={`M${cx - 1.7} ${cy - 1.9} L${cx - 0.4} ${cy - 1.2} M${cx + 1.7} ${cy - 1.9} L${cx + 0.4} ${cy - 1.2}`}
          stroke="rgb(69 26 3)"
          strokeWidth="0.4"
        />
      ) : null}
      <path d={mouth} fill="none" stroke="rgb(69 26 3)" strokeWidth="0.45" />
    </g>
  );
}

function MadSadGlad() {
  const cols = [
    { x: 17, hue: HUE.orange, face: 'rgb(251 146 60)', mood: 'mad' as const },
    { x: 32.5, hue: HUE.blue, face: 'rgb(253 224 71)', mood: 'sad' as const },
    { x: 48, hue: HUE.lime, face: 'rgb(253 224 71)', mood: 'glad' as const },
  ];
  return (
    <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
      <MoodCard x={2} y={4} w={13} h={14} />
      {/* The anonymous idea box: sealed, a lock over its two hidden cards. */}
      <rect
        x={2}
        y={20}
        width="13"
        height="17.5"
        rx="1.5"
        fill="white"
        stroke={SLATE}
        strokeWidth="0.6"
      />
      <rect x={3.5} y={23} width="10" height="9" rx="1" fill="rgb(241 245 249)" />
      <circle cx={8.5} cy={25.6} r="1.8" fill="rgb(224 231 255)" />
      <path
        d="M7.8 25.5 L7.8 24.9 A0.7 0.7 0 0 1 9.2 24.9 L9.2 25.5"
        fill="none"
        stroke={DOT}
        strokeWidth="0.35"
      />
      <rect x={7.4} y={25.4} width="2.2" height="1.5" rx="0.3" fill={DOT} />
      <rect x={5.6} y={28.4} width="5" height="2.6" rx="0.3" fill="rgb(203 213 225)" />
      <rect x={6.4} y={29.2} width="5" height="2.6" rx="0.3" fill="rgb(148 163 184)" />
      <rect
        x={3.5}
        y={33.5}
        width="10"
        height="2.4"
        rx="1.2"
        fill="rgb(241 245 249)"
        stroke={SLATE}
        strokeWidth="0.3"
      />
      <Buttons x={2} y={40} w={13} />
      {cols.map((c) => (
        <g key={c.x}>
          <Column x={c.x} y={4} w={14} h={42} hue={c.hue} notes={6} cols={2} noteTop={12.5} />
          <g
            className={c.mood === 'glad' ? 'pv-pulse' : undefined}
            style={c.mood === 'glad' ? pv({ '--pv-at': '2100ms' }) : undefined}
          >
            <Face cx={c.x + 4} cy={8} fill={c.face} mood={c.mood} />
          </g>
          <rect x={c.x + 8} y="6.4" width="4.5" height="1.6" rx="0.4" fill={c.hue.deep} />
        </g>
      ))}
      <Actions x={63.5} y={4} w={14.5} h={42} rows={5} rowTop={9} />
      <rect x={65} y={30} width="11.5" height="14.5" rx="0.4" fill="rgb(251 207 232)" />
      {/* Hover story: the room answers the mood check, an anonymous card
          drops into the idea box, Glad lights up, and a thank-you heart
          lands on the kind-words note. */}
      <rect
        className="pv-arrive"
        opacity="0"
        x={7.2}
        y={30}
        width="5"
        height="2.6"
        rx="0.3"
        fill="rgb(253 230 138)"
        style={pv({ '--pv-from-x': '0px', '--pv-from-y': '-9px', '--pv-at': '1300ms' })}
      />
      <path
        className="pv-new"
        opacity="0"
        d="M72.5 41.5 C70.2 40 69.6 38.2 70.8 37.5 C71.6 37 72.3 37.5 72.5 38.2 C72.7 37.5 73.4 37 74.2 37.5 C75.4 38.2 74.8 40 72.5 41.5 Z"
        fill="rgb(225 29 72)"
        style={pv({ '--pv-at': '2500ms' })}
      />
    </svg>
  );
}

function FourLs() {
  const quads = [
    { x: 17, y: 4, hue: HUE.green },
    { x: 48, y: 4, hue: HUE.sky },
    { x: 17, y: 20, hue: HUE.amber },
    { x: 48, y: 20, hue: HUE.violet },
  ];
  return (
    <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
      <MoodCard x={2} y={4} w={13} h={16} />
      <Buttons x={2} y={22} w={13} />
      {/* The launch in numbers. */}
      {[2, 6.5, 11].map((sx) => (
        <rect
          key={sx}
          x={sx}
          y={40}
          width="4"
          height="6"
          rx="0.6"
          fill="white"
          stroke="rgb(56 189 248)"
          strokeWidth="0.45"
        />
      ))}
      {quads.map((q) => (
        <g key={`${q.x}-${q.y}`}>
          <rect
            x={q.x}
            y={q.y}
            width="29.5"
            height="14.5"
            rx="1.5"
            fill={q.hue.fill}
            stroke={q.hue.stroke}
            strokeWidth="0.6"
          />
          <rect x={q.x + 1.5} y={q.y + 1.6} width="8" height="1.6" rx="0.4" fill={q.hue.deep} />
          {/* Six notes, two rows of three. */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={q.x + 1.5 + (i % 3) * 9}
              y={q.y + 4.6 + Math.floor(i / 3) * 4.9}
              width="8"
              height="4.3"
              rx="0.4"
              fill={q.hue.note}
            />
          ))}
        </g>
      ))}
      {/* The actions strip under the grid. */}
      <rect
        x={17}
        y={37}
        width="60.5"
        height="9"
        rx="1.5"
        fill="rgb(248 250 252)"
        stroke={SLATE}
        strokeWidth="1"
      />
      <rect x={19} y={39.8} width="9" height="1.6" rx="0.4" fill="rgb(15 23 42)" />
      {[33, 55]
        .flatMap((x) => [38.2, 40.7, 43.2].map((y) => ({ x, y })))
        .map((r) => (
          <g key={`${r.x}-${r.y}`}>
            <rect
              x={r.x}
              y={r.y}
              width="1.8"
              height="1.8"
              rx="0.4"
              fill="white"
              stroke={INK}
              strokeWidth="0.45"
            />
            <line
              x1={r.x + 2.8}
              y1={r.y + 0.9}
              x2={r.x + 19}
              y2={r.y + 0.9}
              stroke={SLATE}
              strokeWidth="0.6"
            />
          </g>
        ))}
      {/* Hover story: the four Ls fill in turn with one more note each,
          dots gather on Lacked, and its action gets ticked. */}
      <Pop at={1100} x={19.5} y={10.3} width="6" height="0.9" rx="0.3" fill="rgb(21 128 61)" />
      <Pop at={1300} x={50.5} y={10.3} width="6" height="0.9" rx="0.3" fill="rgb(3 105 161)" />
      <Pop at={1500} x={19.5} y={26.3} width="6" height="0.9" rx="0.3" fill="rgb(180 83 9)" />
      <Pop at={1700} x={50.5} y={26.3} width="6" height="0.9" rx="0.3" fill="rgb(109 40 217)" />
      <Dots cx={32} cy={31.8} from={1900} />
      <Tick x={32.8} y={37.9} at={2600} />
    </svg>
  );
}

function Sailboat() {
  const wl = 28;
  return (
    <svg width="76" height="46" viewBox="0 0 80 50" aria-hidden>
      <MoodCard x={2} y={4} w={10} h={14} />
      <rect
        x={2}
        y={20}
        width="10"
        height="14"
        rx="1.5"
        fill="white"
        stroke={SLATE}
        strokeWidth="0.6"
      />
      {[23, 26, 29, 32].map((ry) => (
        <line key={ry} x1={3.5} y1={ry} x2={10.5} y2={ry} stroke={SLATE} strokeWidth="0.6" />
      ))}
      <Buttons x={2} y={36} w={10} />
      {/* The scene: sky, the sun setting behind the island, a waved sea,
          the island, rocks and the boat. */}
      <rect
        x={13.5}
        y={4}
        width="51"
        height="42"
        rx="1.5"
        fill="rgb(240 249 255)"
        stroke="rgb(186 230 253)"
        strokeWidth="0.6"
      />
      <circle cx={57.4} cy={wl - 1} r="3" fill="rgb(254 249 195)" />
      <circle cx={57.4} cy={wl - 1} r="2" fill="rgb(253 224 71)" />
      <path
        d={`M13.5 ${wl} Q14.5 ${wl - 1} 15.5 ${wl} Q16.5 ${wl + 1} 17.5 ${wl} Q18.5 ${wl - 1} 19.5 ${wl} Q20.5 ${wl + 1} 21.5 ${wl} Q22.5 ${wl - 1} 23.5 ${wl} Q24.5 ${wl + 1} 25.5 ${wl} Q26.5 ${wl - 1} 27.5 ${wl} Q28.5 ${wl + 1} 29.5 ${wl} Q30.5 ${wl - 1} 31.5 ${wl} Q32.5 ${wl + 1} 33.5 ${wl} Q34.5 ${wl - 1} 35.5 ${wl} Q36.5 ${wl + 1} 37.5 ${wl} Q38.5 ${wl - 1} 39.5 ${wl} Q40.5 ${wl + 1} 41.5 ${wl} Q42.5 ${wl - 1} 43.5 ${wl} Q44.5 ${wl + 1} 45.5 ${wl} Q46.5 ${wl - 1} 47.5 ${wl} Q48.5 ${wl + 1} 49.5 ${wl} Q50.5 ${wl - 1} 51.5 ${wl} Q52.5 ${wl + 1} 53.5 ${wl} Q54.5 ${wl - 1} 55.5 ${wl} Q56.5 ${wl + 1} 57.5 ${wl} Q58.5 ${wl - 1} 59.5 ${wl} Q60.5 ${wl + 1} 61.5 ${wl} Q62.5 ${wl - 1} 63.5 ${wl} L64.5 ${wl} L64.5 44.5 Q64.5 46 63 46 L15 46 Q13.5 46 13.5 44.5 Z`}
        fill="rgb(125 211 252)"
      />
      {/* Island and palm on the horizon. */}
      <path d={`M56 ${wl - 1.5} L56.6 ${wl - 5.6}`} stroke="rgb(146 64 14)" strokeWidth="0.6" />
      <path
        d={`M56.6 ${wl - 5.6} L54.2 ${wl - 4.6} M56.6 ${wl - 5.6} L59 ${wl - 4.7} M56.6 ${wl - 5.6} L55.4 ${wl - 6.8} M56.6 ${wl - 5.6} L58 ${wl - 6.8}`}
        stroke="rgb(22 163 74)"
        strokeWidth="0.7"
      />
      <path d={`M51.8 ${wl + 0.3} Q56.5 ${wl - 3.6} 61.3 ${wl + 0.3} Z`} fill="rgb(252 211 77)" />
      {/* Rocks ahead of the bow. */}
      <path
        d={`M42 ${wl + 0.5} L43 ${wl - 1.8} L43.7 ${wl - 1.3} L44.6 ${wl - 3} L46 ${wl + 0.5} Z`}
        fill="rgb(120 113 108)"
      />
      {/* The boat, sailing on the story. */}
      <g
        className="pv-shift"
        style={pv({ '--pv-dx': '1.5px', '--pv-at': '600ms', '--pv-dur': '2400ms' })}
      >
        <rect x={34.2} y={14.3} width="0.7" height="12.5" fill="rgb(120 53 15)" />
        <path
          d="M35.2 15.2 L39.6 25.6 L35.2 25.6 Z"
          fill="white"
          stroke={SLATE}
          strokeWidth="0.3"
        />
        <path
          d="M33.9 16.6 L33.9 25.6 L30.2 25.6 Z"
          fill="white"
          stroke={SLATE}
          strokeWidth="0.3"
        />
        <path d="M34.9 14.3 L36.9 14.8 L34.9 15.3 Z" fill="rgb(225 29 72)" />
        <path d="M29 26.4 L40.6 26.4 L39 29.6 L30.4 29.6 Z" fill="rgb(180 83 9)" />
      </g>
      {/* Zones, eight notes each: Wind tall on the left of the sky, the
          Island wide across the top right, Anchors and Rocks in the water. */}
      {[
        { x: 14.3, y: 5, w: 12, h: 21.7, hue: HUE.teal, cols: 2 },
        { x: 41.3, y: 5, w: 22.2, h: 13.3, hue: HUE.amber, cols: 4 },
        { x: 14.3, y: 31.7, w: 22.3, h: 13.3, hue: HUE.slate, cols: 4 },
        { x: 37.6, y: 31.7, w: 25.9, h: 13.3, hue: HUE.rose, cols: 4 },
      ].map((z) => {
        const rows = 8 / z.cols;
        const nw = (z.w - 2 - (z.cols - 1) * 0.6) / z.cols;
        const nh = (z.h - 4.6 - (rows - 1) * 0.6) / rows;
        return (
          <g key={`${z.x}-${z.y}`}>
            <rect
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              rx="1"
              fill={z.hue.fill}
              stroke={z.hue.stroke}
              strokeWidth="0.5"
            />
            <rect
              x={z.x + 1}
              y={z.y + 1.2}
              width={Math.min(6, z.w - 2)}
              height="1.2"
              rx="0.3"
              fill={z.hue.deep}
            />
            {Array.from({ length: 8 }, (_, i) => (
              <rect
                key={i}
                x={z.x + 1 + (i % z.cols) * (nw + 0.6)}
                y={z.y + 3.6 + Math.floor(i / z.cols) * (nh + 0.6)}
                width={nw}
                height={nh}
                rx="0.3"
                fill={z.hue.note}
              />
            ))}
          </g>
        );
      })}
      {/* The anchor rope from the hull down to the Anchors card. */}
      <path
        d="M35 29.6 L35.4 31.7"
        stroke="rgb(51 65 85)"
        strokeWidth="0.4"
        strokeDasharray="0.8 0.6"
      />
      <Actions x={66} y={4} w={12} h={42} rows={6} rowTop={9} />
      {/* Hover story: gusts blow from the Wind card into the sails, the
          boat makes way, and dots land on a rock worth steering round. */}
      {[17, 20, 23].map((gy, i) => (
        <rect
          key={gy}
          className="pv-travel"
          opacity="0"
          x={26.8}
          y={gy}
          width="2.4"
          height="0.6"
          rx="0.3"
          fill="rgb(15 118 110)"
          style={pv({ '--pv-dx': '3px', '--pv-at': `${500 + i * 350}ms`, '--pv-dur': '1400ms' })}
        />
      ))}
      <Dots cx={44} cy={38.5} from={1800} />
      <Tick x={67.5} y={9} at={2600} />
    </svg>
  );
}

// Called as plain functions (not <Component />) so the group returns the <svg>
// itself, which TemplatePreview's callers and tests expect.
export function templatePreviewGroup6(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'start-stop-continue':
      return StartStopContinue();
    case 'mad-sad-glad':
      return MadSadGlad();
    case 'four-ls':
      return FourLs();
    case 'sailboat':
      return Sailboat();
    default:
      return null;
  }
}
