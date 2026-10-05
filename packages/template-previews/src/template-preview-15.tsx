import type { ReactElement, ReactNode } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 15: the Plan templates (docs/specs/025-plan/plan-mode.md "Templates"), drawn as the Plan
// board the editor draws: a pale board, columns with their header bars, and white cards with a type
// stripe. Each preview's hover story moves work the way that board is used. The Kanban board keeps
// its own preview in group 2. Static SVG preview tiles; TemplatePreview chains the groups with ??.

const BOARD = 'rgb(248 250 252)';
const BOARD_EDGE = 'rgb(203 213 225)';
const COLUMN = 'rgb(241 245 249)';
const HEAD = 'rgb(100 116 139)';
const CARD_EDGE = 'rgb(203 213 225)';
const TASK = 'rgb(37 99 235)';
const STORY = 'rgb(22 163 74)';
const BUG = 'rgb(220 38 38)';
const EPIC = 'rgb(124 58 237)';
const NOTE = 'rgb(217 119 6)';
const IDEA = 'rgb(13 148 136)';
const ACTION = 'rgb(219 39 119)';

type Card = { stripe: string; moveTo?: { dx: number; dy: number; at: number }; faceDown?: boolean };
type Column = { head?: string; cards: Card[] };

// One card at (x, y), `w` wide: the white face, the type stripe and two lines of title.
function CardFace({ x, y, w, card }: { x: number; y: number; w: number; card: Card }) {
  const style = card.moveTo
    ? pv({
        '--pv-dx': `${card.moveTo.dx}px`,
        '--pv-dy': `${card.moveTo.dy}px`,
        '--pv-at': `${card.moveTo.at}ms`,
      })
    : undefined;
  return (
    <g className={card.moveTo ? 'pv-shift' : undefined} style={style}>
      <rect
        x={x}
        y={y}
        width={w}
        height="6"
        rx="1"
        fill={card.faceDown ? card.stripe : 'white'}
        fillOpacity={card.faceDown ? 0.25 : 1}
        stroke={CARD_EDGE}
        strokeWidth="0.5"
      />
      <rect x={x} y={y} width="1.2" height="6" rx="0.5" fill={card.stripe} />
      {card.faceDown ? null : (
        <rect x={x + 2.4} y={y + 1.6} width={w - 5} height="1" rx="0.5" fill="rgb(148 163 184)" />
      )}
    </g>
  );
}

// The board: columns side by side under the board's title bar, and any story drawn over it.
function board({
  columns,
  rows = 1,
  overlay,
}: {
  columns: Column[];
  rows?: number;
  overlay?: ReactNode;
}) {
  const n = columns.length;
  const gap = 1.6;
  const left = 4;
  const w = (72 - gap * (n - 1)) / n;
  return (
    <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
      <rect
        x="1"
        y="1"
        width="78"
        height="48"
        rx="3"
        fill={BOARD}
        stroke={BOARD_EDGE}
        strokeWidth="0.8"
      />
      <rect x="4" y="4" width="22" height="2.4" rx="1" fill="rgb(51 65 85)" />
      {columns.map((col, i) => {
        const x = left + i * (w + gap);
        return (
          <g key={i}>
            <rect x={x} y="9" width={w} height="37" rx="1.6" fill={COLUMN} />
            <rect x={x} y="9" width={w} height="1.4" rx="0.7" fill={col.head ?? HEAD} />
            <rect
              x={x + 1.4}
              y="12"
              width={Math.min(10, w - 3)}
              height="1.2"
              rx="0.6"
              fill={HEAD}
            />
            {col.cards.map((card, j) => (
              <CardFace
                key={j}
                x={x + 1.2}
                y={16 + j * (rows > 1 ? 13 : 7.6)}
                w={w - 2.4}
                card={card}
              />
            ))}
          </g>
        );
      })}
      {rows > 1
        ? Array.from({ length: rows - 1 }, (_, r) => (
            <rect key={r} x="4" y={28 + r * 13} width="72" height="0.5" fill={BOARD_EDGE} />
          ))
        : null}
      {overlay}
    </svg>
  );
}

export function templatePreviewGroup15(kind: TemplateKind): ReactElement | null {
  const step = (72 - 1.6 * 2) / 3 + 1.6;
  const w4 = (72 - 1.6 * 3) / 4 + 1.6;
  const w5 = (72 - 1.6 * 4) / 5 + 1.6;
  const w6 = (72 - 1.6 * 5) / 6 + 1.6;
  switch (kind) {
    case 'blank-plan':
      // Three empty-ish columns; the story drops a first card into To do.
      return board({
        columns: [
          { cards: [{ stripe: TASK, moveTo: { dx: 0, dy: 0, at: 900 } }] },
          { cards: [] },
          { cards: [] },
        ],
      });
    case 'sprint-board':
      // A row per person; the story moves one story from In progress to In review.
      return board({
        rows: 2,
        columns: [
          { cards: [{ stripe: STORY }, { stripe: TASK }] },
          { cards: [{ stripe: STORY, moveTo: { dx: w4, dy: 0, at: 900 } }, { stripe: BUG }] },
          { cards: [{ stripe: TASK }] },
          { head: STORY, cards: [{ stripe: STORY }, { stripe: TASK }] },
        ],
      });
    case 'bug-triage':
      // Bugs only; the story confirms a new bug.
      return board({
        columns: [
          {
            cards: [
              { stripe: BUG, moveTo: { dx: w5, dy: 7.6, at: 900 } },
              { stripe: BUG },
              { stripe: BUG },
            ],
          },
          { cards: [{ stripe: BUG }] },
          { cards: [{ stripe: BUG }, { stripe: BUG }] },
          { head: STORY, cards: [{ stripe: BUG }] },
          { cards: [{ stripe: BUG }] },
        ],
      });
    case 'team-retro': {
      // Four coloured columns of face-down notes; the story reveals them.
      const notes = (n: number, stripe: string): Card[] =>
        Array.from({ length: n }, () => ({ stripe, faceDown: true }));
      return board({
        columns: [
          { head: STORY, cards: notes(3, NOTE) },
          { head: BUG, cards: notes(3, NOTE) },
          { head: IDEA, cards: notes(2, IDEA) },
          { head: ACTION, cards: [{ stripe: ACTION, faceDown: true }] },
        ],
        overlay: [0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            className="pv-new"
            opacity="0"
            x={4 + i * w4 + 3.6}
            y="17.6"
            width="8"
            height="1"
            rx="0.5"
            fill="rgb(71 85 105)"
            style={pv({ '--pv-at': `${900 + i * 160}ms` })}
          />
        )),
      });
    }
    case 'roadmap-board':
      // Epics on Now, Next and Later; the story pulls an epic from Next into Now.
      return board({
        columns: [
          { cards: [{ stripe: EPIC }, { stripe: EPIC }] },
          {
            cards: [{ stripe: EPIC, moveTo: { dx: -step, dy: 15.2, at: 900 } }, { stripe: EPIC }],
          },
          { cards: [{ stripe: EPIC }, { stripe: EPIC }] },
        ],
      });
    case 'weekly-planner':
      // A column a day; the story carries Monday's leftover to Tuesday.
      return board({
        columns: [
          { cards: [{ stripe: TASK }, { stripe: TASK, moveTo: { dx: w5, dy: 0, at: 900 } }] },
          { cards: [{ stripe: TASK }] },
          { cards: [{ stripe: ACTION }] },
          { cards: [{ stripe: TASK }, { stripe: TASK }] },
          { cards: [{ stripe: TASK }] },
        ],
      });
    case 'project-overview':
      // A row per project, At Risk in amber; the story brings a task back on track.
      return board({
        rows: 2,
        columns: [
          { cards: [{ stripe: TASK }, { stripe: TASK }] },
          { cards: [{ stripe: TASK }] },
          { head: NOTE, cards: [{ stripe: TASK, moveTo: { dx: -w4, dy: 0, at: 900 } }] },
          { head: STORY, cards: [{ stripe: TASK }, { stripe: TASK }] },
        ],
      });
    case 'daily-standup':
      // A row per person, Blocked in red; the story unblocks a task into Today.
      return board({
        rows: 2,
        columns: [
          { cards: [{ stripe: TASK }, { stripe: TASK }] },
          { cards: [{ stripe: TASK }, { stripe: ACTION }] },
          { head: BUG, cards: [{ stripe: TASK, moveTo: { dx: -step, dy: 0, at: 900 } }] },
        ],
      });
    case 'content-calendar':
      // Ideas to Published; the story schedules a reviewed piece.
      return board({
        columns: [
          { cards: [{ stripe: IDEA }, { stripe: IDEA }, { stripe: IDEA }] },
          { cards: [{ stripe: TASK }, { stripe: TASK }] },
          { cards: [{ stripe: TASK, moveTo: { dx: w5, dy: 0, at: 900 } }] },
          { cards: [{ stripe: TASK }] },
          { head: STORY, cards: [{ stripe: TASK }, { stripe: TASK }] },
        ],
      });
    case 'hiring-pipeline':
      // Applied to Hired; the story moves a candidate from Interview to Offer.
      return board({
        columns: [
          { cards: [{ stripe: TASK }, { stripe: TASK }, { stripe: TASK }] },
          { cards: [{ stripe: TASK }, { stripe: TASK }] },
          { cards: [{ stripe: TASK, moveTo: { dx: w6, dy: 0, at: 900 } }, { stripe: TASK }] },
          { cards: [] },
          { head: STORY, cards: [{ stripe: TASK }] },
          { cards: [{ stripe: NOTE }] },
        ],
      });
    default:
      return null;
  }
}
