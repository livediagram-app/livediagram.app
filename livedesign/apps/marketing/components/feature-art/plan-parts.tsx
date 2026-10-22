// The Plan cards' shared vocabulary (docs/specs/026-plan/item-types.md): item types' stripes, the
// people on the boards, and a card and a column heading as the board draws them. Used by ./plan and
// ./plan-views.

import { Avatar, INK, MUTED, SURFACE, TEAMMATE, YOU } from './mode-parts';

// Item types' colour stripes (docs/specs/026-plan/item-types.md), and Bug, a team's own type.
export const TYPE = {
  project: '#8b5cf6',
  task: '#0ea5e9',
  note: '#64748b',
  idea: '#f59e0b',
  action: '#10b981',
  bug: '#ef4444',
} as const;
export type TypeKey = keyof typeof TYPE;

export type Person = { initials: string; colour: string };
export const AK: Person = { initials: 'AK', colour: '#8b5cf6' };
export const SM: Person = { initials: 'SM', colour: '#10b981' };
export const JR: Person = { initials: 'JR', colour: TEAMMATE };
export const TM: Person = { initials: 'TM', colour: YOU };

export const AMBER_RING = '#fbbf24';

/** A card as the board draws it: its type's stripe, a title, its number and who has it. */
export function PlanCard({
  x,
  y,
  w = 62,
  title,
  id,
  type = 'task',
  who,
  ring,
}: {
  x: number;
  y: number;
  w?: number;
  title: string;
  id: string;
  type?: TypeKey;
  who?: Person;
  ring?: string;
}) {
  return (
    <g>
      <rect
        className={ring ? 'fill-white dark:fill-slate-800' : SURFACE}
        x={x}
        y={y}
        width={w}
        height="19"
        rx="2.5"
        fill="#fff"
        stroke={ring ?? '#e2e8f0'}
        strokeWidth={ring ? 1.2 : 0.8}
      />
      <rect x={x} y={y} width="2.2" height="19" rx="1" fill={TYPE[type]} />
      <text className={INK} x={x + 5.5} y={y + 7.8} fontSize="6.2" fontWeight="600" fill="#1e293b">
        {title}
      </text>
      <text className={MUTED} x={x + 5.5} y={y + 15.4} fontSize="5" fontWeight="500" fill="#64748b">
        {id}
      </text>
      {who ? (
        <Avatar x={x + w - 6} y={y + 13} initials={who.initials} colour={who.colour} r={3.6} />
      ) : null}
    </g>
  );
}

/** A column's heading: its name and, when given, its count. */
export function ColumnHead({
  x,
  y,
  name,
  count,
}: {
  x: number;
  y: number;
  name: string;
  count?: string;
}) {
  return (
    <g>
      <text className={INK} x={x} y={y} fontSize="6.4" fontWeight="700" fill="#1e293b">
        {name}
      </text>
      {count ? (
        <text
          className={MUTED}
          x={x + name.length * 3.9 + 3.5}
          y={y}
          fontSize="6"
          fontWeight="600"
          fill="#64748b"
        >
          {count}
        </text>
      ) : null}
    </g>
  );
}
