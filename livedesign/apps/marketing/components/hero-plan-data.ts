import { TEAMMATE, YOU } from '@/components/art-tokens';
import type { CardDef, Person } from './hero-plan-card';

// The hero's Plan board as data (hero-plan-board.tsx draws it): its columns and cards as the board
// opens, who carries which card where, and the card quick-added last.

const AK: Person = { initials: 'AK', colour: '#8b5cf6' };
const JR: Person = { initials: 'JR', colour: TEAMMATE };
const SM: Person = { initials: 'SM', colour: '#10b981' };
const ME: Person = { initials: 'TM', colour: YOU };

type Column = { name: string; wip?: number; cards: CardDef[] };

// The board as it opens. The two carried cards are the last in their columns, so nothing closes up
// behind them.
export const COLUMNS: Column[] = [
  {
    name: 'Backlog',
    cards: [
      { title: 'Referral program', type: 'idea', n: 27, who: SM, priority: 'low', label: 'growth' },
      { title: 'Dark mode emails', type: 'idea', n: 30, who: AK, priority: 'low', label: 'design' },
    ],
  },
  {
    name: 'To do',
    cards: [
      {
        title: 'Pricing page',
        type: 'task',
        n: 14,
        who: AK,
        priority: 'high',
        label: 'web',
        due: { text: '14 Oct' },
      },
      {
        title: 'Beta invites',
        type: 'task',
        n: 16,
        who: ME,
        priority: 'medium',
        label: 'growth',
        checklist: { done: 2, of: 5 },
      },
    ],
  },
  {
    name: 'In progress',
    wip: 3,
    cards: [
      {
        title: 'API docs',
        type: 'task',
        n: 9,
        who: SM,
        priority: 'medium',
        label: 'docs',
        checklist: { done: 3, of: 4 },
      },
      {
        title: 'Login bug',
        type: 'bug',
        n: 21,
        who: JR,
        priority: 'urgent',
        due: { text: '12 Oct', soon: true },
      },
    ],
  },
  {
    name: 'Review',
    wip: 2,
    cards: [
      { title: 'Status page', type: 'task', n: 18, who: AK, priority: 'low', label: 'web' },
      {
        title: 'Onboarding emails',
        type: 'task',
        n: 11,
        who: JR,
        priority: 'high',
        label: 'growth',
      },
    ],
  },
  {
    name: 'Done',
    cards: [
      { title: 'Logo refresh', type: 'idea', n: 3, who: AK, priority: 'medium', label: 'design' },
      {
        title: 'Launch checklist',
        type: 'task',
        n: 7,
        who: ME,
        priority: 'high',
        checklist: { done: 6, of: 6 },
      },
      { title: 'Press kit', type: 'task', n: 5, who: SM, priority: 'low', label: 'press' },
    ],
  },
];

// Who carries what, from the last card of one column to the foot of another.
export const MOVES = [
  { from: 3, to: 4, who: TEAMMATE, name: 'JR' },
  { from: 1, to: 2, who: YOU, name: 'TM' },
] as const;

// Typed into To do's quick add; `@sam` and `#docs` become the assignee and a label.
export const QUICK_TITLE = 'Release notes';
export const QUICK_TYPED = `${QUICK_TITLE} @sam #docs`;
export const QUICK: CardDef = {
  title: QUICK_TITLE,
  type: 'task',
  n: 23,
  who: SM,
  priority: 'medium',
  label: 'docs',
};
export const QUICK_COLUMN = 1;

// The board as it rests, once both cards have moved and the quick add has landed: what its bar
// (PlanBoardBar in hero-editor-chrome.tsx, "33% done · 4/12") and the counts agree with.
export function settledColumns(): CardDef[][] {
  const cols = COLUMNS.map((c) => [...c.cards]);
  for (const m of MOVES) cols[m.to]!.push(cols[m.from]!.pop()!);
  cols[QUICK_COLUMN]!.push(QUICK);
  return cols;
}
