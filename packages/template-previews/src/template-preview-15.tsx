import type { ReactElement, ReactNode } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 15: the Plan templates (docs/specs/026-plan/plan-templates.md), drawn as the Plan board the
// editor draws: a pale board, columns with their header bars, and white cards with a type stripe. A
// template of several tabs shows a strip of tabs over its first board, the first one open; a board of
// projects shows its Gantt under it. Each preview's hover story moves work the way that board is used.
// The Kanban board keeps its own preview in group 2. Static SVG preview tiles; TemplatePreview chains
// the groups with ??.

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

// The template's tabs across the top, the first one open, in place of the board's title bar.
function TabStrip({ count }: { count: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={4 + i * 12.5}
          y="2.8"
          width="11"
          height="3.6"
          rx="1.2"
          fill={i === 0 ? 'rgb(51 65 85)' : 'rgb(226 232 240)'}
        />
      ))}
    </g>
  );
}

// A Gantt Chart under a board of projects: a bar per project, the first filling as it goes.
function GanttPanel({ bars }: { bars: { x: number; w: number }[] }) {
  return (
    <g>
      <rect
        x="4"
        y="30"
        width="72"
        height="16"
        rx="1.6"
        fill="white"
        stroke={BOARD_EDGE}
        strokeWidth="0.5"
      />
      <rect x="44" y="31" width="0.5" height="14" fill={BUG} />
      {bars.map((bar, i) => (
        <g key={i}>
          <rect x="6" y={33 + i * 4} width="8" height="1.2" rx="0.6" fill="rgb(148 163 184)" />
          <rect
            x={bar.x}
            y={32.4 + i * 4}
            width={bar.w}
            height="2.4"
            rx="1"
            fill={EPIC}
            fillOpacity="0.35"
          />
          {i === 0 ? (
            <rect
              className="pv-new"
              opacity="0"
              x={bar.x}
              y={32.4}
              width={bar.w * 0.6}
              height="2.4"
              rx="1"
              fill={EPIC}
              style={pv({ '--pv-at': '900ms' })}
            />
          ) : null}
        </g>
      ))}
    </g>
  );
}

// The board: columns side by side under the board's title bar (or the template's tabs), any Gantt under
// them, and any story drawn over it.
function board({
  columns,
  rows = 1,
  overlay,
  tabs,
  gantt,
}: {
  columns: Column[];
  rows?: number;
  overlay?: ReactNode;
  tabs?: number;
  gantt?: { x: number; w: number }[];
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
      {tabs ? (
        <TabStrip count={tabs} />
      ) : (
        <rect x="4" y="4" width="22" height="2.4" rx="1" fill="rgb(51 65 85)" />
      )}
      {columns.map((col, i) => {
        const x = left + i * (w + gap);
        return (
          <g key={i}>
            <rect x={x} y="9" width={w} height={gantt ? 19 : 37} rx="1.6" fill={COLUMN} />
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
      {gantt ? <GanttPanel bars={gantt} /> : null}
      {rows > 1
        ? Array.from({ length: rows - 1 }, (_, r) => (
            <rect key={r} x="4" y={28 + r * 13} width="72" height="0.5" fill={BOARD_EDGE} />
          ))
        : null}
      {overlay}
    </svg>
  );
}

// Blank Plan: an empty tab showing Start with a Board, a 3 by 2 grid of small board tiles (each a few column
// strips) under the picker's title; the hover story rings the first tile, as a pick.
function boardPicker() {
  const tiles = [0, 1, 2, 3, 4, 5];
  const colsPer = [3, 4, 3, 4, 2, 3];
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
      <rect x="6" y="5" width="26" height="2.6" rx="1" fill="rgb(51 65 85)" />
      <rect x="6" y="9.4" width="40" height="1.2" rx="0.6" fill="rgb(148 163 184)" />
      {tiles.map((t) => {
        const x = 6 + (t % 3) * 23;
        const y = 14 + Math.floor(t / 3) * 17;
        const n = colsPer[t]!;
        const cw = (17 - 1 * (n - 1)) / n;
        return (
          <g key={t}>
            <rect
              x={x}
              y={y}
              width="21"
              height="15"
              rx="1.6"
              fill="white"
              stroke={CARD_EDGE}
              strokeWidth="0.5"
            />
            {Array.from({ length: n }, (_, c) => (
              <rect
                key={c}
                x={x + 2 + c * (cw + 1)}
                y={y + 2}
                width={cw}
                height="7"
                rx="0.6"
                fill={COLUMN}
              />
            ))}
            <rect x={x + 2} y={y + 11} width="9" height="1.2" rx="0.6" fill={HEAD} />
            {t === 0 ? (
              <rect
                className="pv-new"
                opacity="0"
                x={x - 0.6}
                y={y - 0.6}
                width="22.2"
                height="16.2"
                rx="2"
                fill="none"
                stroke={TASK}
                strokeWidth="0.9"
                style={pv({ '--pv-at': '700ms' })}
              />
            ) : null}
          </g>
        );
      })}
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
      // An empty Plan tab: the Start with a Board picker, a tile per board; the story picks the first.
      return boardPicker();
    case 'project-planner':
      // Roadmap: projects on Now, Next, Later, Shipped over their Gantt; the story ships a project.
      return board({
        tabs: 4,
        columns: [
          { cards: [{ stripe: EPIC, moveTo: { dx: w4 * 3, dy: 0, at: 900 } }] },
          { cards: [{ stripe: EPIC }] },
          { cards: [{ stripe: EPIC }] },
          { head: STORY, cards: [] },
        ],
        gantt: [
          { x: 18, w: 26 },
          { x: 30, w: 22 },
          { x: 46, w: 26 },
        ],
      });
    case 'bug-triage':
      // Triage, a row per priority; the story confirms a new bug.
      return board({
        tabs: 3,
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
          { cards: [{ stripe: BUG }] },
          { cards: [{ stripe: BUG }] },
        ],
      });
    case 'team-retro': {
      // Three coloured columns of face-down notes and ideas; the story reveals them.
      const notes = (n: number, stripe: string): Card[] =>
        Array.from({ length: n }, () => ({ stripe, faceDown: true }));
      return board({
        tabs: 3,
        columns: [
          { head: STORY, cards: notes(3, NOTE) },
          { head: BUG, cards: notes(3, NOTE) },
          { head: IDEA, cards: notes(2, IDEA) },
        ],
        overlay: [0, 1, 2].map((i) => (
          <rect
            key={i}
            className="pv-new"
            opacity="0"
            x={4 + i * step + 3.6}
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
    case 'weekly-planner':
      // A column a day and Done; the story carries Monday's leftover to Tuesday.
      return board({
        tabs: 3,
        columns: [
          { cards: [{ stripe: TASK }, { stripe: TASK, moveTo: { dx: w6, dy: 0, at: 900 } }] },
          { cards: [{ stripe: TASK }] },
          { cards: [{ stripe: ACTION }] },
          { cards: [{ stripe: TASK }, { stripe: TASK }] },
          { cards: [{ stripe: TASK }] },
          { head: STORY, cards: [{ stripe: TASK }] },
        ],
      });
    case 'content-calendar':
      // Production, Approved to Published; the story schedules a reviewed piece.
      return board({
        tabs: 3,
        columns: [
          { head: STORY, cards: [{ stripe: IDEA }, { stripe: IDEA }, { stripe: IDEA }] },
          { cards: [{ stripe: TASK }, { stripe: TASK }] },
          { cards: [{ stripe: TASK, moveTo: { dx: w5, dy: 0, at: 900 } }] },
          { cards: [{ stripe: TASK }] },
          { head: STORY, cards: [{ stripe: TASK }, { stripe: TASK }] },
        ],
      });
    case 'hiring-pipeline':
      // Roles: projects on a Gantt; the story fills a role.
      return board({
        tabs: 3,
        columns: [
          { cards: [{ stripe: EPIC }] },
          { cards: [{ stripe: EPIC, moveTo: { dx: w4 * 2, dy: 0, at: 900 } }, { stripe: EPIC }] },
          { head: NOTE, cards: [] },
          { head: STORY, cards: [{ stripe: EPIC }] },
        ],
        gantt: [
          { x: 22, w: 30 },
          { x: 34, w: 30 },
          { x: 18, w: 20 },
        ],
      });
    case 'okrs':
      // Key Results by objective, On Track to Off Track; the story brings one back on track.
      return board({
        tabs: 2,
        rows: 2,
        columns: [
          { cards: [{ stripe: TASK }] },
          { head: STORY, cards: [{ stripe: TASK }, { stripe: TASK }] },
          { head: NOTE, cards: [{ stripe: TASK, moveTo: { dx: -w5, dy: 0, at: 900 } }] },
          { head: BUG, cards: [{ stripe: TASK }] },
          { cards: [{ stripe: TASK }] },
        ],
      });
    case 'product-launch':
      // Workstreams over their Gantt; the story readies a workstream.
      return board({
        tabs: 3,
        columns: [
          { cards: [{ stripe: EPIC }] },
          { cards: [{ stripe: EPIC, moveTo: { dx: w4, dy: 0, at: 900 } }, { stripe: EPIC }] },
          { head: STORY, cards: [] },
          { cards: [] },
        ],
        gantt: [
          { x: 18, w: 22 },
          { x: 28, w: 28 },
          { x: 40, w: 30 },
        ],
      });
    case 'feedback-board':
      // Requests voted on; the story plans the top one.
      return board({
        tabs: 2,
        columns: [
          { cards: [{ stripe: IDEA }, { stripe: IDEA }, { stripe: IDEA }] },
          { cards: [{ stripe: IDEA, moveTo: { dx: w4, dy: 0, at: 900 } }, { stripe: IDEA }] },
          { head: IDEA, cards: [{ stripe: IDEA }] },
          { cards: [{ stripe: IDEA }] },
        ],
      });
    default:
      return null;
  }
}
