'use client';

// The board picker's pictures (docs/specs/026-plan/plan-mode.md "Starting a board"): each board drawn as what sets it
// apart, so no two read alike: a Kanban board's WIP limit and Done ticks, a to-do list's checklist, a sprint's rows
// per person with estimates, a retro's coloured columns of face-down notes and votes, a roadmap's project bars, bug
// triage's priority rows, a week's days, All Cards' status rows, and Blank's empty board waiting to be set up. In the
// tab's own light or dark look. Decorative: the tile's name and line say what it is.
import type { ReactNode } from 'react';
import type { PlanPalette } from './plan-palette';

type P = { palette: PlanPalette };

// Brand-neutral accents for the pictures, read on light and dark alike.
const BLUE = '#3b82f6';
const GREEN = '#22c55e';
const RED = '#ef4444';
const AMBER = '#f59e0b';
const TEAL = '#14b8a6';
const VIOLET = '#8b5cf6';

function Frame({ palette, children }: P & { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-16 w-full flex-col gap-1 overflow-hidden rounded-lg border p-1.5 sm:h-24"
      style={{ backgroundColor: palette.surface, borderColor: palette.border }}
    >
      <span
        className="h-1.5 w-1/3 shrink-0 rounded-full"
        style={{ backgroundColor: palette.muted, opacity: 0.5 }}
      />
      <div className="flex min-h-0 flex-1 gap-1">{children}</div>
    </div>
  );
}

function Column({
  palette,
  head,
  children,
}: P & { head?: string | undefined; children?: ReactNode }) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-[3px] rounded p-[3px]"
      style={{ backgroundColor: palette.column }}
    >
      <span
        className="h-[3px] w-full shrink-0 rounded-full"
        style={{ backgroundColor: head ?? palette.border }}
      />
      {children}
    </div>
  );
}

function Card({
  palette,
  stripe,
  wide,
  children,
}: P & { stripe?: string; wide?: boolean; children?: ReactNode }) {
  return (
    <span
      className={`relative flex shrink-0 items-center gap-[2px] overflow-hidden rounded-[2px] border pl-[4px] pr-[2px] ${wide ? 'h-3' : 'h-2.5'}`}
      style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
    >
      {stripe ? (
        <span className="absolute inset-y-0 left-0 w-[2px]" style={{ backgroundColor: stripe }} />
      ) : null}
      {children}
    </span>
  );
}

const Line = ({ palette, w = 'w-3/5' }: P & { w?: string }) => (
  <span
    className={`h-[2px] ${w} rounded-full`}
    style={{ backgroundColor: palette.muted, opacity: 0.45 }}
  />
);

const Dot = ({ colour, size = 4 }: { colour: string; size?: number }) => (
  <span
    className="shrink-0 rounded-full"
    style={{ width: size, height: size, backgroundColor: colour }}
  />
);

// Kanban: columns of cards, the busy one wearing its WIP limit, Done's cards ticked.
function Kanban({ palette }: P) {
  const cols: { n: number; wip?: boolean; done?: boolean }[] = [
    { n: 3 },
    { n: 2 },
    { n: 3, wip: true },
    { n: 1 },
    { n: 2, done: true },
  ];
  return (
    <Frame palette={palette}>
      {cols.map((c, i) => (
        <Column key={i} palette={palette} head={c.done ? GREEN : undefined}>
          {c.wip ? (
            <span
              className="self-end rounded-[2px] px-[2px] text-[5px] font-bold leading-[7px]"
              style={{ backgroundColor: `${AMBER}33`, color: AMBER }}
            >
              3
            </span>
          ) : null}
          {Array.from({ length: c.n }, (_, k) => (
            <Card key={k} palette={palette} stripe={[BLUE, VIOLET, BLUE][k % 3]}>
              {c.done ? <Dot colour={GREEN} size={3} /> : null}
              <Line palette={palette} />
            </Card>
          ))}
        </Column>
      ))}
    </Frame>
  );
}

// To-do list: a checklist, two ticked and struck through.
function Todo({ palette }: P) {
  const rows = [true, true, false, false];
  return (
    <Frame palette={palette}>
      <div
        className="flex flex-1 flex-col gap-[3px] rounded p-[3px]"
        style={{ backgroundColor: palette.column }}
      >
        {rows.map((done, i) => (
          <span
            key={i}
            className="flex h-3 shrink-0 items-center gap-1 rounded-[2px] border px-1"
            style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
          >
            <span
              className="flex h-[6px] w-[6px] shrink-0 items-center justify-center rounded-[1px] border"
              style={{
                borderColor: done ? GREEN : palette.muted,
                backgroundColor: done ? GREEN : 'transparent',
              }}
            />
            <span
              className="h-[2px] rounded-full"
              style={{
                width: `${[55, 40, 65, 45][i]}%`,
                backgroundColor: palette.muted,
                opacity: done ? 0.3 : 0.6,
              }}
            />
          </span>
        ))}
      </div>
    </Frame>
  );
}

// Sprint: a row per person (their disc), cards carrying estimate pills.
function Sprint({ palette }: P) {
  const people = [BLUE, VIOLET];
  return (
    <div
      aria-hidden
      className="flex h-16 w-full flex-col gap-1 overflow-hidden rounded-lg border p-1.5 sm:h-24"
      style={{ backgroundColor: palette.surface, borderColor: palette.border }}
    >
      <span
        className="h-1.5 w-1/3 shrink-0 rounded-full"
        style={{ backgroundColor: palette.muted, opacity: 0.5 }}
      />
      {people.map((who, r) => (
        <div key={r} className="flex min-h-0 flex-1 items-start gap-1">
          <span className="mt-[2px]">
            <Dot colour={who} size={6} />
          </span>
          {[2, 1, 2, 1].map((n, c) => (
            <div
              key={c}
              className="flex min-w-0 flex-1 flex-col gap-[3px] rounded p-[2px]"
              style={{ backgroundColor: palette.column }}
            >
              {Array.from({ length: Math.max(1, n - r) }, (_, k) => (
                <Card key={k} palette={palette} stripe={BLUE}>
                  <Line palette={palette} w="w-2/5" />
                  <span
                    className="ml-auto rounded-full px-[2px] text-[5px] font-bold leading-[6px]"
                    style={{ backgroundColor: palette.column, color: palette.muted }}
                  >
                    {[3, 5, 2][(c + k + r) % 3]}
                  </span>
                </Card>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Retro: Went Well, To Improve, Try in their colours, notes face-down (hatched) and a few votes.
function Retro({ palette }: P) {
  const heads = [GREEN, RED, TEAL];
  return (
    <Frame palette={palette}>
      {heads.map((h, i) => (
        <Column key={i} palette={palette} head={h}>
          {Array.from({ length: [3, 2, 2][i]! }, (_, k) => (
            <span
              key={k}
              className="flex h-3 shrink-0 items-center justify-end gap-[2px] rounded-[2px] border px-[2px]"
              style={{
                borderColor: palette.cardBorder,
                backgroundImage: `repeating-linear-gradient(135deg, ${h}33 0 3px, transparent 3px 6px)`,
              }}
            >
              {Array.from({ length: (i + k) % 3 }, (_, v) => (
                <Dot key={v} colour={h} size={3} />
              ))}
            </span>
          ))}
        </Column>
      ))}
    </Frame>
  );
}

// Roadmap: Now, Next and Later holding projects, each a colour bar.
function Roadmap({ palette }: P) {
  const cols = [[BLUE, VIOLET], [TEAL, AMBER, BLUE], [VIOLET]];
  return (
    <Frame palette={palette}>
      {cols.map((projects, i) => (
        <Column key={i} palette={palette}>
          {projects.map((c, k) => (
            <span
              key={k}
              className="flex h-3 shrink-0 items-center gap-1 rounded-[2px] border px-1"
              style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
            >
              <Dot colour={c} size={4} />
              <span className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: c }} />
            </span>
          ))}
        </Column>
      ))}
    </Frame>
  );
}

// Bug triage: a row per priority (its signal bars), red bug cards across the columns.
function BugTriage({ palette }: P) {
  const priorities = [RED, AMBER, palette.muted];
  return (
    <div
      aria-hidden
      className="flex h-16 w-full flex-col gap-[3px] overflow-hidden rounded-lg border p-1.5 sm:h-24"
      style={{ backgroundColor: palette.surface, borderColor: palette.border }}
    >
      <span
        className="h-1.5 w-1/3 shrink-0 rounded-full"
        style={{ backgroundColor: palette.muted, opacity: 0.5 }}
      />
      {priorities.map((p, r) => (
        <div key={r} className="flex min-h-0 flex-1 items-center gap-1">
          <span className="flex h-[7px] w-[9px] shrink-0 items-end gap-[1px]">
            {[3, 5, 7].map((h, b) => (
              <span
                key={b}
                className="w-[2px] rounded-[1px]"
                style={{ height: h, backgroundColor: b < 3 - r ? p : palette.border }}
              />
            ))}
          </span>
          {[1, 0, 1, 1].map((has, c) => (
            <div
              key={c}
              className="flex h-full min-w-0 flex-1 items-center rounded px-[2px]"
              style={{ backgroundColor: palette.column }}
            >
              {has && (c + r) % 2 === 0 ? (
                <Card palette={palette} stripe={RED}>
                  <Line palette={palette} w="w-3/5" />
                </Card>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Weekly planner: a column a day, Monday to Friday, today's head lit.
function Weekly({ palette }: P) {
  const days = ['M', 'T', 'W', 'T', 'F'];
  return (
    <Frame palette={palette}>
      {days.map((d, i) => (
        <div
          key={i}
          className="flex min-w-0 flex-1 flex-col gap-[3px] rounded p-[3px]"
          style={{ backgroundColor: palette.column }}
        >
          <span
            className="self-center rounded-full px-[3px] text-[6px] font-bold leading-[8px]"
            style={
              i === 2 ? { backgroundColor: `${BLUE}26`, color: BLUE } : { color: palette.muted }
            }
          >
            {d}
          </span>
          {Array.from({ length: [2, 1, 2, 1, 1][i]! }, (_, k) => (
            <Card key={k} palette={palette} stripe={[BLUE, AMBER, VIOLET][(i + k) % 3]}>
              <Line palette={palette} />
            </Card>
          ))}
        </div>
      ))}
    </Frame>
  );
}

// All Cards: a row per status, led by its dot, the cards in it across.
function AllCards({ palette }: P) {
  const statuses = [palette.muted, BLUE, AMBER, GREEN];
  return (
    <div
      aria-hidden
      className="flex h-16 w-full flex-col gap-[3px] overflow-hidden rounded-lg border p-1.5 sm:h-24"
      style={{ backgroundColor: palette.surface, borderColor: palette.border }}
    >
      <span
        className="h-1.5 w-1/3 shrink-0 rounded-full"
        style={{ backgroundColor: palette.muted, opacity: 0.5 }}
      />
      {statuses.map((s, r) => (
        <div
          key={r}
          className="flex min-h-0 flex-1 items-center gap-1 rounded px-1"
          style={{ backgroundColor: palette.column }}
        >
          <Dot colour={s} size={5} />
          {Array.from({ length: [3, 2, 2, 4][r]! }, (_, k) => (
            <span
              key={k}
              className="h-[5px] w-4 shrink-0 rounded-[1px] border"
              style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Blank: an empty board, dashed, waiting for Setup Board.
function Blank({ palette }: P) {
  return (
    <div
      aria-hidden
      className="flex h-16 w-full items-center justify-center rounded-lg border-2 border-dashed sm:h-24"
      style={{ borderColor: palette.border, backgroundColor: palette.surface }}
    >
      <span
        className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-semibold"
        style={{
          borderColor: palette.cardBorder,
          backgroundColor: palette.card,
          color: palette.muted,
        }}
      >
        <span className="text-[10px] leading-none">+</span>
        Setup Board
      </span>
    </div>
  );
}

// The picture for a preset, or null where the picker draws its generic board.
export const BOARD_PREVIEWS: Partial<Record<string, (p: P) => ReactNode>> = {
  blank: Blank,
  kanban: Kanban,
  todo: Todo,
  sprint: Sprint,
  retro: Retro,
  roadmap: Roadmap,
  'bug-triage': BugTriage,
  weekly: Weekly,
  'all-cards': AllCards,
};
