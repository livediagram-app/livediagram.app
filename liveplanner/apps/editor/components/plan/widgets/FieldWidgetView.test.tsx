// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  boardFields,
  presetSetup,
  projectBoard,
  type CustomFieldDef,
  type FieldWidgetKey,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { boardItems } from '@liveplanner/plan-art';
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
    quick: {},
    onQuick: vi.fn(),
    onRemove: vi.fn(),
    ...over,
  };
  render(<FieldWidgetView id={id as FieldWidgetKey} ctx={ctx} />);
  return ctx;
}
const pill = () => document.querySelector<HTMLElement>('[data-field-widget]')!;

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

  // The name and ": no values yet" share one run, so the pill's flex gap never opens before the colon.
  it('keeps the colon against the name when a field has no values yet', () => {
    show('field:sum:f-empty');
    const run = screen.getByText(': no values yet').parentElement;
    expect(run?.textContent).toBe('Hours: no values yet');
    expect(run?.parentElement).toBe(pill());
  });

  it('names the first two values of a Breakdown and counts the rest', () => {
    show('field:breakdown:f-team');
    expect(pill().textContent).toContain('+1');
  });

  describe('pressing a value', () => {
    const chip = (field: string, key: string) => ({ by: 'field', field, key });

    it('presses a Breakdown value into a field chip, for a Viewer too', () => {
      const onQuick = vi.fn();
      show('field:breakdown:f-sev', { canEdit: false, onQuick });
      expect(pill().getAttribute('role')).toBe('group');
      const high = screen.getByRole('button', { name: 'Only Severity: High' });
      expect(high.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(high);
      expect(onQuick).toHaveBeenCalledWith({ filters: [chip('f-sev', 'f:"High"')] });
    });

    it('shows the value pressed while its chip is on, and a second press takes it off', () => {
      const onQuick = vi.fn();
      show('field:breakdown:f-sev', {
        quick: { text: 'x', filters: [chip('f-sev', 'f:"High"')] as never },
        onQuick,
      });
      const high = screen.getByRole('button', { name: 'Only Severity: High' });
      expect(high.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(high);
      expect(onQuick).toHaveBeenCalledWith({ text: 'x' });
    });

    it('replaces the other value of a one-value field, and stacks the values of Labels', () => {
      const onQuick = vi.fn();
      show('field:breakdown:f-sev', {
        quick: { filters: [chip('f-sev', 'f:"High"')] as never },
        onQuick,
      });
      fireEvent.click(screen.getByRole('button', { name: 'Only Severity: Medium' }));
      expect(onQuick).toHaveBeenCalledWith({ filters: [chip('f-sev', 'f:"Medium"')] });
      cleanup();
      show('field:breakdown:f-team', {
        quick: { filters: [chip('f-team', 'f:"Web"')] as never },
        onQuick,
      });
      fireEvent.click(screen.getByRole('button', { name: 'Only Team: Design' }));
      expect(onQuick).toHaveBeenLastCalledWith({
        filters: [chip('f-team', 'f:"Web"'), chip('f-team', 'f:"Design"')],
      });
    });

    it('presses a Donut value and a person by id', () => {
      const onQuick = vi.fn();
      show('field:donut:f-owner', { onQuick });
      fireEvent.click(screen.getByRole('button', { name: 'Only Owner: Ana' }));
      expect(onQuick).toHaveBeenCalledWith({ filters: [chip('f-owner', 'f:p:ana')] });
    });

    it('narrows the board to the cards holding the value', () => {
      const f = { by: 'field' as const, field: 'f-team', key: 'f:"Web"' };
      const board = projectBoard(
        setup,
        new Map(items.map((i) => [i.id, i])),
        { filters: [f] },
        types,
      );
      expect(boardItems(board)).toHaveLength(2);
    });

    describe('every value, through "+n"', () => {
      const more = (name: string) => screen.getByRole('button', { name: `More ${name} values` });
      const legend = (name: string) => screen.getByRole('dialog', { name: `${name} values` });

      it('opens a Breakdown legend of every value, each pressing its chip, and stays open', () => {
        const onQuick = vi.fn();
        show('field:breakdown:f-team', { canEdit: false, onQuick });
        const trigger = more('Team');
        expect(trigger.textContent).toBe('+1');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        const rows = [...legend('Team').querySelectorAll('button')];
        expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
          'Only Team: Web',
          'Only Team: Design',
          'Only Team: Ops',
        ]);
        expect(rows.map((r) => r.textContent)).toEqual(['Web2', 'Design1', 'Ops1']);
        fireEvent.click(rows[2]!);
        expect(onQuick).toHaveBeenCalledWith({ filters: [chip('f-team', 'f:"Ops"')] });
        expect(legend('Team')).toBeTruthy();
        // Pressing "+n" again closes it, and so does Escape, focus back on "+n".
        fireEvent.click(trigger);
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(trigger);
        fireEvent.keyDown(legend('Team'), { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
      });

      it('shows a Donut every value with its share, its commonest still in the pill', () => {
        const onQuick = vi.fn();
        show('field:donut:f-sev', { onQuick });
        expect(screen.getByRole('button', { name: 'Only Severity: High' })).toBeTruthy();
        fireEvent.click(more('Severity'));
        const rows = [...legend('Severity').querySelectorAll('button')];
        expect(rows.map((r) => r.textContent)).toEqual(['High33%1', 'Medium33%1', 'Low33%1']);
        fireEvent.click(screen.getAllByRole('button', { name: 'Only Severity: Low' }).at(-1)!);
        expect(onQuick).toHaveBeenCalledWith({ filters: [chip('f-sev', 'f:"Low"')] });
      });

      it('leaves "+n" off when the pill already names every value', () => {
        show('field:donut:f-owner');
        expect(screen.queryByRole('button', { name: /^More / })).toBeNull();
        cleanup();
        show('field:breakdown:f-sev', { items: items.slice(0, 2) });
        expect(screen.queryByRole('button', { name: /^More / })).toBeNull();
      });

      it('reads pressed in the legend, and on "+n" while a value it holds is on', () => {
        show('field:breakdown:f-team', {
          quick: { filters: [chip('f-team', 'f:"Ops"')] as never },
        });
        const trigger = screen.getByRole('button', { name: 'More Team values, 1 pressed' });
        fireEvent.click(trigger);
        const ops = [...legend('Team').querySelectorAll('button')].at(-1)!;
        expect(ops.getAttribute('aria-pressed')).toBe('true');
        cleanup();
        show('field:breakdown:f-team', {
          quick: { filters: [chip('f-team', 'f:"Web"')] as never },
        });
        expect(more('Team')).toBeTruthy();
      });

      it('disables a legend row that no longer fits at the chip cap', () => {
        const full = Array.from({ length: 8 }, (_, i) => chip(`f-x${i}`, 'k')) as never;
        show('field:breakdown:f-team', { quick: { filters: full } });
        fireEvent.click(more('Team'));
        const rows = [...legend('Team').querySelectorAll<HTMLButtonElement>('button')];
        expect(rows.every((r) => r.disabled)).toBe(true);
      });

      it('takes a press on "+n" and in the legend before the board does', () => {
        const onBoard = vi.fn();
        document.addEventListener('pointerdown', onBoard);
        show('field:breakdown:f-team');
        fireEvent.pointerDown(more('Team'));
        fireEvent.click(more('Team'));
        fireEvent.pointerDown(legend('Team').firstElementChild!);
        document.removeEventListener('pointerdown', onBoard);
        expect(onBoard).not.toHaveBeenCalled();
      });
    });

    it('disables a value that no longer fits at the chip cap', () => {
      const full = Array.from({ length: 8 }, (_, i) => chip(`f-x${i}`, 'k')) as never;
      show('field:breakdown:f-sev', { quick: { filters: full } });
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Only Severity: High' }).disabled,
      ).toBe(true);
    });
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
