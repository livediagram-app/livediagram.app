import { at } from '@/components/art-tokens';
import {
  ACCENT,
  ACCENT_INK,
  Avatar,
  Card,
  Check,
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
import { TIMER_AT } from './hero-townhall-facilitator';

// The Facilitator kit (timer, applause pad, poll) and the Follow-ups live in hero-townhall-facilitator.tsx.
export { Timer, Applause, Poll, FollowUps } from './hero-townhall-facilitator';

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
