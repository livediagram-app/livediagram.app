import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  FIELD_WIDGETS_MAX,
  boardFields,
  ITEM_TYPES,
  type BoardWidgetId,
  type ItemTypeDef,
} from '@liveplanner/items';
import { changedWidgets, resolveWidget, widgetName } from './board-widget-change';

// change_board's widgets by name (docs/specs/026-plan/plan-agents.md "Changing a board").
const FEATURE: ItemTypeDef = {
  ...ITEM_TYPES[0],
  id: 'feature',
  label: 'Feature',
  color: '#7c3aed',
  fields: ['title', 'status', 'f-budget', 'f-sev', 'f-notes'],
  custom: [
    { id: 'f-budget', label: 'Budget', kind: 'currency' },
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['High', 'Low'] },
    { id: 'f-notes', label: 'Notes', kind: 'text' },
  ],
};
const ALL = boardFields({}, [FEATURE], false);

describe('resolveWidget', () => {
  it('reads a built-in by id, or by its gallery name', () => {
    expect(resolveWidget('due', ALL)).toEqual({ ok: true, id: 'due' });
    expect(resolveWidget('Item Count', ALL)).toEqual({ ok: true, id: 'count' });
    expect(resolveWidget(' top voted ', ALL)).toEqual({ ok: true, id: 'top-voted' });
  });

  it('reads a field widget by its field and view, or the field alone for its first view', () => {
    expect(resolveWidget('Budget Sum', ALL)).toEqual({ ok: true, id: 'field:sum:f-budget' });
    expect(resolveWidget('budget average', ALL)).toEqual({
      ok: true,
      id: 'field:average:f-budget',
    });
    expect(resolveWidget('Severity', ALL)).toEqual({ ok: true, id: 'field:breakdown:f-sev' });
    expect(resolveWidget('f-budget', ALL)).toEqual({ ok: true, id: 'field:sum:f-budget' });
    expect(resolveWidget('field:range:f-gone', ALL)).toEqual({
      ok: true,
      id: 'field:range:f-gone',
    });
  });

  it('refuses a field no widget reads, and an unknown name, naming what the board offers', () => {
    const notes = resolveWidget('Notes', ALL);
    expect(notes).toMatchObject({ ok: false, code: 'board_invalid' });
    expect(!notes.ok && notes.message).toMatch(/^"Notes" is a field no widget reads/);
    const mood = resolveWidget('Mood', ALL);
    expect(!mood.ok && mood.message).toContain('Budget (Sum, Average, Range, Spread)');
    expect(!mood.ok && mood.message).toContain('Severity (Breakdown, Donut)');
    const bare = resolveWidget('Mood', []);
    expect(!bare.ok && bare.message).toContain('have no field a widget reads');
  });
});

describe('changedWidgets', () => {
  const start: BoardWidgetId[] = ['count', 'progress'];

  it('adds at the end and removes, remove read first; one it has stays where it is', () => {
    expect(
      changedWidgets(start, { add: ['Budget Sum', 'count'], remove: ['progress'] }, ALL),
    ).toEqual({ ok: true, widgets: ['count', 'field:sum:f-budget'] });
    // Removing one the board does not show changes nothing.
    expect(changedWidgets(start, { remove: ['Budget Sum'] }, ALL)).toEqual({
      ok: true,
      widgets: start,
    });
  });

  it('refuses a raw key its field or view does not fit, an unknown name, and a 13th field widget', () => {
    expect(changedWidgets(start, { add: ['field:sum:f-sev'] }, ALL)).toMatchObject({
      ok: false,
      message: expect.stringContaining('reads no field'),
    });
    expect(changedWidgets(start, { add: ['Mood'] }, ALL)).toMatchObject({ ok: false });
    expect(changedWidgets(start, { remove: ['Mood'] }, ALL)).toMatchObject({ ok: false });
    const full = Array.from(
      { length: FIELD_WIDGETS_MAX },
      (_, i) => `field:sum:f-x${i}` as BoardWidgetId,
    );
    expect(changedWidgets(full, { add: ['Budget Sum'] }, ALL)).toMatchObject({
      ok: false,
      message: `A board holds up to ${FIELD_WIDGETS_MAX} field widgets: remove one to add "Budget Sum".`,
    });
  });
});

describe('widgetName', () => {
  it('names a kind, a field widget, and a gone field widget by its key', () => {
    expect(widgetName('count', ALL)).toBe('Item Count');
    expect(widgetName('field:sum:f-budget', ALL)).toBe('Budget Sum');
    expect(widgetName('field:sum:f-gone', ALL)).toBe('field:sum:f-gone');
  });
});

// The names are keyed once a call, so a change naming every widget a board holds, over a board with 200 number fields,
// stays well inside an agent write's budget (measured 1.2 ms a call on a loaded machine, 4.0 ms before keying).
describe('changedWidgets at size', () => {
  it('resolves 27 names against 200 fields within its CPU budget', () => {
    const custom = Array.from({ length: 200 }, (_, i) => ({
      id: `f-n${i}`,
      label: `Number ${i}`,
      kind: 'currency' as const,
    }));
    const wide = boardFields({}, [{ ...FEATURE, fields: custom.map((c) => c.id), custom }], false);
    const add = Array.from({ length: FIELD_WIDGETS_MAX }, (_, i) => `Number ${199 - i} Spread`);
    const remove = Array<string>(15).fill('Number 0 Spread');
    let out: ReturnType<typeof changedWidgets> | undefined;
    const ms = cpuMsOf(() => {
      for (let r = 0; r < 10; r++) out = changedWidgets([], { add, remove }, wide);
    });
    expect(out).toMatchObject({ ok: true });
    expect(ms / 10).toBeLessThan(cpuBudgetMs(20));
  });
});
