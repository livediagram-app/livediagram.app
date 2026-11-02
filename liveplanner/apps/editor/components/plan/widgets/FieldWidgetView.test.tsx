// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  boardFields,
  presetSetup,
  type CustomFieldDef,
  type FieldWidgetKey,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { planPalette } from '../plan-palette';
import { FieldWidgetView, type FieldWidgetContext } from './FieldWidgetView';

// docs/specs/026-plan/board-widgets.md "Field widgets": each view's pill, a field with no values yet, and a field gone.
afterEach(cleanup);

const custom = [
  { id: 'f-budget', label: 'Budget', kind: 'currency', currency: 'GBP' },
  { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['High', 'Medium', 'Low'] },
  { id: 'f-team', label: 'Team', kind: 'labels' },
  { id: 'f-owner', label: 'Owner', kind: 'person' },
  { id: 'f-ok', label: 'Approved', kind: 'checkbox' },
  { id: 'f-launch', label: 'Launch', kind: 'date' },
  { id: 'f-stars', label: 'Confidence', kind: 'rating', scale: 5 },
  { id: 'f-big', label: 'Score', kind: 'rating', scale: 10 },
  { id: 'f-empty', label: 'Hours', kind: 'number' },
] as CustomFieldDef[];
const types: ItemTypeDef[] = [
  {
    id: 'feature',
    label: 'Feature',
    newTitle: 'New',
    glyph: 'task',
    color: '#7c3aed',
    fields: ['title', 'status', ...custom.map((c) => c.id)],
    custom,
  },
];
const setup: PlanBoardSetup = { ...presetSetup('kanban'), addTypes: ['feature'] };
const NOW = new Date(2026, 9, 10, 12);
const ANA = { id: 'ana', name: 'Ana', color: '#2563eb' };
let n = 0;
const card = (fields: Item['fields']): Item =>
  ({
    id: `i${++n}`,
    type: 'feature',
    key: n,
    rank: `r${n}`,
    fields: { status: 'todo', ...fields },
    createdBy: ANA,
    updatedBy: ANA,
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as Item;
const items = [
  card({
    'f-budget': 1000,
    'f-sev': 'High',
    'f-team': ['Web', 'Ops'],
    'f-owner': ANA,
    'f-ok': true,
    'f-launch': '2026-10-08',
    'f-stars': 4,
    'f-big': 7,
  }),
  card({
    'f-budget': 3000,
    'f-sev': 'Low',
    'f-team': ['Web'],
    'f-launch': '2026-10-12',
    'f-stars': 2,
  }),
  card({ 'f-sev': 'Medium', 'f-team': ['Design'] }),
];

function show(id: string, over: Partial<FieldWidgetContext> = {}) {
  const ctx: FieldWidgetContext = {
    fields: boardFields(setup, types),
    items,
    setup,
    palette: planPalette('light', {}),
    now: NOW,
    canEdit: true,
    onRemove: vi.fn(),
    ...over,
  };
  render(<FieldWidgetView id={id as FieldWidgetKey} ctx={ctx} />);
  return ctx;
}
const pill = () => screen.getByRole('img');

describe('FieldWidgetView', () => {
  it.each([
    ['field:sum:f-budget', 'Budget Sum, on Feature cards: £4,000 over 2 cards'],
    ['field:average:f-budget', 'Budget Average, on Feature cards: average £2,000 over 2 cards'],
    ['field:range:f-budget', 'Budget Range, on Feature cards: £1,000 to £3,000'],
    ['field:spread:f-budget', 'Budget Spread, on Feature cards: 2 cards from £1,000 to £3,000'],
    [
      'field:stars:f-stars',
      'Confidence Average Stars, on Feature cards: average 3.0 of 5 over 2 cards',
    ],
    ['field:stars:f-big', 'Score Average Stars, on Feature cards: average 7.0 of 10 over 1 card'],
    ['field:breakdown:f-sev', 'Severity Breakdown, on Feature cards: 1 High, 1 Medium, 1 Low'],
    ['field:donut:f-sev', 'Severity Donut, on Feature cards: High 33%; 1 High, 1 Medium, 1 Low'],
    ['field:breakdown:f-team', 'Team Breakdown, on Feature cards: 2 Web, 1 Design, 1 Ops'],
    ['field:donut:f-owner', 'Owner Donut, on Feature cards: Ana 100%; 1 Ana'],
    ['field:ticked:f-ok', 'Approved Ticked, on Feature cards: 1 of 3 ticked'],
    ['field:upcoming:f-launch', 'Launch Upcoming, on Feature cards: 1 overdue, 1 due soon'],
    [
      'field:timeline:f-launch',
      'Launch Timeline, on Feature cards: 1 overdue, 1 due in the next four weeks',
    ],
    ['field:sum:f-empty', 'Hours Sum, on Feature cards: no values yet'],
  ])('%s reads its field', (id, spoken) => {
    show(id);
    expect(pill().getAttribute('aria-label')).toBe(spoken);
  });

  it('names the first two values of a Breakdown and counts the rest', () => {
    show('field:breakdown:f-team');
    expect(pill().textContent).toContain('+1');
  });

  it('says Nothing due when no date is close', () => {
    show('field:upcoming:f-launch', { items: [card({ 'f-launch': '2026-12-01' })] });
    expect(pill().textContent).toContain('Nothing due');
    cleanup();
    show('field:upcoming:f-launch', { items: [card({ 'f-launch': '2026-10-12' })] });
    expect(pill().getAttribute('aria-label')).toContain('0 overdue, 1 due soon');
  });

  it('shows a removed field quietly, with Remove for someone who may edit', () => {
    const ctx = show('field:sum:f-gone');
    expect(screen.getByText('This field was removed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove widget' }));
    expect(ctx.onRemove).toHaveBeenCalledWith('field:sum:f-gone');
  });

  it('shows a field whose kind no longer fits the view', () => {
    show('field:sum:f-sev');
    expect(screen.getByText('This field changed kind')).toBeTruthy();
  });

  // docs/specs/026-plan/board-widgets.md "Share roles": every role sees field widgets; only an Editor removes one.
  it.each([
    ['edit', true],
    ['participate', false],
    ['view', false],
  ] as const)('a %s link sees a gone field, with Remove: %s', (role, offered) => {
    const canEdit = resolveEditorCapabilities({ level: role, adderKey: 'k' }).level === 'edit';
    show('field:sum:f-gone', { canEdit });
    expect(screen.getByText('This field was removed')).toBeTruthy();
    expect(!!screen.queryByRole('button', { name: 'Remove widget' })).toBe(offered);
    cleanup();
    show('field:sum:f-budget', { canEdit });
    expect(pill().getAttribute('aria-label')).toContain('£4,000');
  });
});
