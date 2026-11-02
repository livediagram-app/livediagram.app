import { at } from '@/components/art-tokens';
import {
  ACCENT,
  ACCENT_INK,
  Avatar,
  Card,
  Check,
  EMOJI,
  FAINT,
  Handle,
  Heading,
  INK,
  MUTED,
  PANEL,
  Sticker,
  TRACK,
  Txt,
  type Box,
  type Person,
} from './hero-townhall-parts';

// The Town Hall window's columns around its Q&A board (hero-townhall-board.tsx), each as the Town
// Hall Q&A template builds it: the title, On the panel, the Run of show, the Facilitator kit's
// timer, applause pad and poll, and the Follow-ups checklist.

export type KitLayout = {
  title: { x: number; y: number; size: number; sticker: number };
  // A wide window gives the panel a column of cards and the agenda under it; a phone a row of discs.
  panel?: { x: number; y: number; w: number; cardH: number };
  panelRow?: { x: number; y: number };
  agenda?: Box;
  timer: Box;
  applause: Box;
  poll: Box;
  follow: Box & { caption: boolean };
};

const PANEL_PEOPLE: (Person & { role: string })[] = [
  { initials: 'MC', name: 'Maya Chen', role: 'CEO · hosting', colour: '#7c3aed' },
  { initials: 'DP', name: 'Dev Patel', role: 'CFO · the numbers', colour: '#0891b2' },
  { initials: 'PN', name: 'Priya Nair', role: 'Head of Product', colour: '#db2777' },
];

// When the timer starts (you press it) and the seconds it then counts down through.
const TIMER_AT = 5.5;
const TICKS = 16;

export function Title({ x, y, size, sticker }: KitLayout['title']) {
  const width = size * 0.5 * 24;
  return (
    <g className="hm-fade" style={at(0.1)}>
      <Txt x={x} y={y} size={size} weight={800}>
        Q3 all-hands · Town hall
      </Txt>
      <g className="hm-pop" style={at(0.5)}>
        <Sticker
          x={x + width + 6}
          y={y - size - sticker * 0.2}
          size={sticker}
          glyph="🎤"
          label="Microphone"
        />
      </g>
      {size > 16 ? (
        <Txt x={x} y={y + 13} size={8} className={MUTED}>
          Ask anything, named or anonymous. Upvote the questions you most want answered.
        </Txt>
      ) : null}
    </g>
  );
}

// On the panel: a card per person, an initials disc, their name and their part.
export function OnThePanel({ x, y, w, cardH }: NonNullable<KitLayout['panel']>) {
  return (
    <>
      <g className="hm-fade" style={at(0.2)}>
        <Heading x={x} y={y - 10}>
          On the panel
        </Heading>
      </g>
      {PANEL_PEOPLE.map((p, i) => {
        const cy = y + i * (cardH + 4);
        return (
          <g key={p.initials} className="hm-pop" style={at(0.35 + i * 0.12)}>
            <Card box={{ x, y: cy, w, h: cardH }} rx={8} />
            <Avatar cx={x + 17} cy={cy + cardH / 2} r={9.5} person={p} />
            <Txt x={x + 33} y={cy + 14} size={9.5} weight={700}>
              {p.name}
            </Txt>
            <Txt x={x + 33} y={cy + 25} size={7.5} className={MUTED}>
              {p.role}
            </Txt>
          </g>
        );
      })}
    </>
  );
}

// A phone's panel: the three discs in a row and their names.
export function PanelRow({ x, y }: NonNullable<KitLayout['panelRow']>) {
  return (
    <g className="hm-fade" style={at(0.3)}>
      {PANEL_PEOPLE.map((p, i) => (
        <g key={p.initials}>
          <circle cx={x + 9 + i * 15} cy={y + 9} r="10" className="fill-(--art-paper)" />
          <Avatar cx={x + 9 + i * 15} cy={y + 9} r={9} person={p} />
        </g>
      ))}
      <Txt x={x + 52} y={y + 12.5} size={9} className={MUTED}>
        On the panel: Maya, Dev and Priya
      </Txt>
    </g>
  );
}

const SEGMENTS = [
  { label: 'Welcome', who: 'Maya', min: 5 },
  { label: 'Q3 in numbers', who: 'Dev', min: 10 },
  { label: 'What we ship next', who: 'Priya', min: 10 },
  { label: 'Open Q&A', who: 'everyone', min: 30 },
  { label: 'Wrap-up and thanks', who: 'Maya', min: 5 },
];
const NOW = 3;

// The run of show: the agenda element, its segments with their minutes, those done ticked and Open
// Q&A live, its progress filling.
export function Agenda({ box }: { box: Box }) {
  const rowH = 29;
  return (
    <>
      <g className="hm-fade" style={at(0.5)}>
        <Heading x={box.x} y={box.y - 10}>
          Run of show
        </Heading>
      </g>
      <g className="hm-pop" style={at(0.7)}>
        <Card box={box} rx={14} className={PANEL} />
        <Handle x={box.x + 12} y={box.y + 14} />
        <Txt x={box.x + 25} y={box.y + 17.5} size={9.5} weight={700} className={ACCENT_INK}>
          Agenda
        </Txt>
        <Txt
          x={box.x + box.w - 12}
          y={box.y + 17}
          size={7}
          weight={700}
          anchor="end"
          className={MUTED}
        >
          1H
        </Txt>
        {/* The rail the segments hang on. */}
        <line
          x1={box.x + 15}
          x2={box.x + 15}
          y1={box.y + 36}
          y2={box.y + 36 + rowH * (SEGMENTS.length - 1)}
          stroke={ACCENT}
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
      </g>
      {SEGMENTS.map((s, i) => {
        const cy = box.y + 36 + i * rowH;
        const done = i < NOW;
        const now = i === NOW;
        return (
          <g key={s.label} className="hm-fade" style={at(0.9 + i * 0.08)}>
            {done ? (
              <>
                <circle cx={box.x + 15} cy={cy} r="5" fill={ACCENT} />
                <Check x={box.x + 15} y={cy} className="stroke-white" size={0.65} />
              </>
            ) : now ? (
              <>
                <circle
                  cx={box.x + 15}
                  cy={cy}
                  r="5"
                  className="fill-(--art-ink-fill)"
                  stroke={ACCENT}
                  strokeWidth="1.6"
                />
                <circle className="hm-live" cx={box.x + 15} cy={cy} r="2.2" fill={ACCENT} />
              </>
            ) : (
              <circle
                cx={box.x + 15}
                cy={cy}
                r="4.5"
                className="fill-(--art-ink-fill)"
                stroke={ACCENT}
                strokeOpacity="0.5"
                strokeWidth="1.3"
              />
            )}
            <Txt
              x={box.x + 27}
              y={cy - 1}
              size={8.5}
              weight={now ? 700 : 500}
              className={now ? ACCENT_INK : done ? MUTED : INK}
            >
              {s.label}
            </Txt>
            {now ? null : (
              <Txt x={box.x + 27} y={cy + 9} size={7} className={FAINT}>
                {s.who}
              </Txt>
            )}
            <Txt
              x={box.x + box.w - 12}
              y={cy + 2}
              size={7.5}
              weight={600}
              anchor="end"
              className={now ? ACCENT_INK : MUTED}
            >
              {`${s.min}m`}
            </Txt>
            {now ? (
              <>
                <rect
                  x={box.x + 27}
                  y={cy + 5}
                  width={box.w - 66}
                  height="3"
                  rx="1.5"
                  className={TRACK}
                />
                <rect
                  className="hm-wipe"
                  style={at(TIMER_AT)}
                  x={box.x + 27}
                  y={cy + 5}
                  width={(box.w - 66) * 0.35}
                  height="3"
                  rx="1.5"
                  fill={ACCENT}
                />
              </>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

// The Q&A timer, a session button: its ruler, TIMER and the time, waiting on 30:00 until you press
// play, then counting down second by second, play turned to pause.
export function Timer({ box, portrait }: { box: Box; portrait: boolean }) {
  const digitsY = box.y + box.h - 11;
  const size = portrait ? 16 : 14;
  const x = box.x + 9;
  return (
    <g className="hm-pop" style={at(0.9)}>
      <Card box={box} rx={10} />
      {/* The ruler along its top edge. */}
      {Array.from({ length: 13 }, (_, i) => (
        <line
          key={i}
          x1={box.x + 10 + i * ((box.w - 20) / 12)}
          x2={box.x + 10 + i * ((box.w - 20) / 12)}
          y1={box.y}
          y2={box.y + (i % 3 === 0 ? 4 : 2.5)}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="0.8"
        />
      ))}
      <Txt x={x} y={box.y + 15} size={6.5} weight={700} className={MUTED} letterSpacing={0.8}>
        TIMER
      </Txt>
      <g className="hm-out" style={at(TIMER_AT)}>
        <Txt x={x} y={digitsY} size={size} weight={800}>
          30:00
        </Txt>
        <path
          d={`M${box.x + box.w - 15} ${digitsY - 9} l6 4 l-6 4 z`}
          className="fill-slate-600 dark:fill-slate-300"
        />
      </g>
      <g className="hm-fade" style={at(TIMER_AT)}>
        <Txt x={x} y={digitsY} size={size} weight={800} className={ACCENT_INK}>
          29:
        </Txt>
        <rect
          x={box.x + box.w - 15}
          y={digitsY - 9.5}
          width="2.2"
          height="8"
          rx="0.8"
          fill={ACCENT}
        />
        <rect
          x={box.x + box.w - 11}
          y={digitsY - 9.5}
          width="2.2"
          height="8"
          rx="0.8"
          fill={ACCENT}
        />
      </g>
      {Array.from({ length: TICKS }, (_, i) => {
        const d = TIMER_AT + i;
        const text = String(59 - i).padStart(2, '0');
        const digit = (
          <Txt
            className={`hm-fade ${ACCENT_INK}`}
            style={at(d)}
            x={x + size * 1.62}
            y={digitsY}
            size={size}
            weight={800}
          >
            {text}
          </Txt>
        );
        // Each second gives way to the next; the last one stays.
        return i === TICKS - 1 ? (
          <g key={i}>{digit}</g>
        ) : (
          <g key={i} className="hm-out" style={at(d + 1)}>
            {digit}
          </g>
        );
      })}
      {/* A running timer breathes in the accent. */}
      <rect
        className="hm-fade"
        style={at(TIMER_AT)}
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx="10"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.4"
      />
    </g>
  );
}

const FLOATS = [
  { glyph: '👏', d: 7.0, dx: -10 },
  { glyph: '❤️', d: 7.4, dx: 12 },
  { glyph: '👏', d: 7.9, dx: 0 },
  { glyph: '🎉', d: 8.5, dx: -16 },
  { glyph: '👏', d: 9.0, dx: 14 },
  { glyph: '🙌', d: 9.6, dx: -4 },
  { glyph: '👏', d: 10.2, dx: 8 },
];

// The applause pad: a reaction pad wearing the clapping-hands sticker; every press sends a
// reaction floating up over the canvas.
export function Applause({ box }: { box: Box }) {
  const cx = box.x + box.w / 2;
  return (
    <>
      <g className="hm-pop" style={at(1.0)}>
        <Card
          box={box}
          rx={12}
          className="fill-sky-50 stroke-sky-400 dark:fill-sky-500/10 dark:stroke-sky-500/50"
        />
        <Txt
          x={cx}
          y={box.y + box.h * 0.6}
          size={box.h * 0.42}
          anchor="middle"
          className=""
          style={{ fontFamily: EMOJI }}
        >
          👏
        </Txt>
        <rect
          x={cx - 21}
          y={box.y + box.h - 13}
          width="42"
          height="10"
          rx="5"
          className="fill-white/90 dark:fill-slate-900/80"
        />
        <Txt
          x={cx}
          y={box.y + box.h - 5.6}
          size={6.5}
          weight={700}
          anchor="middle"
          className={MUTED}
        >
          Applause
        </Txt>
      </g>
      {FLOATS.map((f, i) => (
        <g
          key={i}
          className="hm-float"
          style={{ ...at(f.d), transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          <Txt
            x={cx + f.dx}
            y={box.y + 4}
            size={12}
            anchor="middle"
            className=""
            style={{ fontFamily: EMOJI }}
          >
            {f.glyph}
          </Txt>
        </g>
      ))}
    </>
  );
}

const POLL = [1, 2, 6, 14, 15];
const POLL_AT = 7.4;

// The closing poll, running: How useful was today, 1 to 5, the votes filling in over faint tracks.
export function Poll({ box }: { box: Box }) {
  const max = Math.max(...POLL);
  const tight = box.h < 100;
  const barsTop = box.y + (tight ? 34 : 40);
  const barsH = box.h - (tight ? 50 : 66);
  const gap = 6;
  const barW = (box.w - 20 - gap * (POLL.length - 1)) / POLL.length;
  return (
    <g className="hm-pop" style={at(1.1)}>
      <Card box={box} rx={10} />
      <rect
        x={box.x + 9}
        y={box.y + 8}
        width="22"
        height="10"
        rx="5"
        fill={ACCENT}
        fillOpacity="0.14"
      />
      <Txt
        x={box.x + 20}
        y={box.y + 15.4}
        size={6}
        weight={800}
        anchor="middle"
        className={ACCENT_INK}
        letterSpacing={0.5}
      >
        POLL
      </Txt>
      <circle className="hm-live" cx={box.x + box.w - 30} cy={box.y + 13} r="2.2" fill="#ef4444" />
      <Txt
        x={box.x + box.w - 9}
        y={box.y + 15.4}
        size={6}
        weight={800}
        anchor="end"
        className="fill-red-600 dark:fill-red-400"
        letterSpacing={0.5}
      >
        LIVE
      </Txt>
      <Txt x={box.x + 9} y={box.y + (tight ? 29 : 31)} size={tight ? 8.5 : 9.5} weight={700}>
        How useful was today?
      </Txt>
      {POLL.map((n, i) => {
        const h = (n / max) * barsH;
        const x = box.x + 10 + i * (barW + gap);
        return (
          <g key={i}>
            <rect x={x} y={barsTop} width={barW} height={barsH} rx="3.5" className={TRACK} />
            <rect
              className="hm-grow"
              style={at(POLL_AT + i * 0.12)}
              x={x}
              y={barsTop + barsH - h}
              width={barW}
              height={h}
              rx="3.5"
              fill={ACCENT}
              fillOpacity={0.35 + (n / max) * 0.65}
            />
            <Txt
              x={x + barW / 2}
              y={barsTop + barsH + 9}
              size={7}
              weight={600}
              anchor="middle"
              className={MUTED}
            >
              {i + 1}
            </Txt>
          </g>
        );
      })}
      {tight ? null : (
        <g className="hm-fade" style={at(POLL_AT + 0.9)}>
          <Txt x={box.x + 9} y={box.y + box.h - 8} size={7.5} className={MUTED}>
            38 votes
          </Txt>
          <Txt x={box.x + box.w - 9} y={box.y + box.h - 8} size={8.5} weight={800} anchor="end">
            4.3 avg
          </Txt>
        </g>
      )}
    </g>
  );
}

const ITEMS = [
  { text: 'Share the Fridays policy', who: 'Maya', d: 1.25 },
  { text: 'EU launch date', who: 'Priya, by Fri', d: 1.35 },
  { text: 'Offsite budget', who: 'Dev', d: 10.1 },
];
const TICK_AT = 9.4;

// Follow-ups: the checklist the panel's answers-to-come go on, one ticked off as it is answered and
// one added after the discussion.
export function FollowUps({ box, caption }: { box: Box; caption: boolean }) {
  const items = box.h < 90 ? ITEMS.slice(0, 2) : ITEMS;
  const rowH = (box.h - 14) / items.length;
  return (
    <>
      <g className="hm-fade" style={at(1.2)}>
        {caption ? (
          <>
            <Heading x={box.x} y={box.y - 21}>
              Follow-ups
            </Heading>
            <Txt x={box.x} y={box.y - 8} size={7.5} className={MUTED}>
              What the panel can’t answer live, with an owner.
            </Txt>
          </>
        ) : null}
        <Card box={box} rx={12} className={PANEL} />
      </g>
      {items.map((it, i) => {
        const cy = box.y + 7 + rowH * i + rowH / 2;
        const ticked = i === 0;
        const label = (
          <Txt x={box.x + 25} y={cy + 3} size={8.5} weight={500} className={INK}>
            {it.text}
            <tspan className={MUTED}>{` · ${it.who}`}</tspan>
          </Txt>
        );
        return (
          <g key={it.text} className="hm-pop" style={at(it.d)}>
            <rect
              x={box.x + 10}
              y={cy - 5}
              width="10"
              height="10"
              rx="2.5"
              className="fill-white dark:fill-slate-900"
              stroke={ACCENT}
              strokeWidth="1.3"
            />
            {ticked ? (
              <>
                <g className="hm-pop" style={at(TICK_AT)}>
                  <rect x={box.x + 10} y={cy - 5} width="10" height="10" rx="2.5" fill={ACCENT} />
                  <Check x={box.x + 15} y={cy} className="stroke-white" size={0.6} />
                </g>
                <g className="hm-out" style={at(TICK_AT)}>
                  {label}
                </g>
                <g className="hm-fade" style={at(TICK_AT)} opacity="0.55">
                  {label}
                </g>
                <rect
                  className="hm-wipe fill-slate-500 dark:fill-slate-400"
                  style={at(TICK_AT + 0.1)}
                  x={box.x + 25}
                  y={cy - 0.5}
                  width={it.text.length * 4.3}
                  height="1"
                />
              </>
            ) : (
              label
            )}
          </g>
        );
      })}
    </>
  );
}
