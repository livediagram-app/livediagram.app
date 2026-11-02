import { describe, expect, it } from 'vitest';
import { readDashboard, remapDashboardElements, type DashboardContent } from './dashboard';
import {
  DASHBOARD_SLOT_NAME_MAX,
  isNamedSlotType,
  readSlotName,
  slotNameOf,
  withSlotName,
} from './slot-name';

// docs/specs/026-plan/plan-tabs.md "A slot's name".

const layoutOf = (content: unknown) => ({
  rows: [{ id: 'r', height: 320, slots: [{ id: 's', span: 12, content }] }],
});
const read = (content: unknown) => readDashboard(layoutOf(content))!.rows[0]!.slots[0]!.content;

describe('a slot name', () => {
  it('is offered on a plan view element and on either figure only', () => {
    expect(['element', 'sheet-metric', 'form-metric'].every(isNamedSlotType)).toBe(true);
    expect(
      ['tab', 'note', 'title', 'status', 'checklist', 'key-date', 'links'].some(isNamedSlotType),
    ).toBe(false);
  });

  it('reads trimmed and capped, and nothing when empty or not text', () => {
    expect(readSlotName('  Launch readiness  ')).toBe('Launch readiness');
    expect(readSlotName('x'.repeat(DASHBOARD_SLOT_NAME_MAX + 20))).toHaveLength(
      DASHBOARD_SLOT_NAME_MAX,
    );
    expect(readSlotName('   ')).toBeUndefined();
    expect(readSlotName(12)).toBeUndefined();
    expect(readSlotName(undefined)).toBeUndefined();
  });

  it('is read with the stored content of a named kind, and dropped from any other', () => {
    expect(read({ type: 'element', elementId: 'e1', name: ' Launch ' })).toEqual({
      type: 'element',
      elementId: 'e1',
      name: 'Launch',
    });
    expect(read({ type: 'element', elementId: 'e1', name: '' })).toEqual({
      type: 'element',
      elementId: 'e1',
    });
    expect(
      read({ type: 'form-metric', metric: 'responses', formTabId: 't', name: 'Sign-ups' }),
    ).toEqual({
      type: 'form-metric',
      metric: 'responses',
      formTabId: 't',
      name: 'Sign-ups',
    });
    expect(
      read({ type: 'sheet-metric', metric: 'figure', sheetId: '', name: 'Budget left' }),
    ).toMatchObject({
      name: 'Budget left',
    });
    expect(read({ type: 'tab', tabId: 't', name: 'Nope' })).toEqual({ type: 'tab', tabId: 't' });
    expect(read({ type: 'note', title: 'A', text: 'B', name: 'Nope' })).not.toHaveProperty('name');
  });

  it('keeps its name when its element is given a new id', () => {
    const layout = readDashboard(layoutOf({ type: 'element', elementId: 'e1', name: 'Launch' }))!;
    const next = remapDashboardElements(layout, new Map([['e1', 'e2']]));
    expect(next.rows[0]!.slots[0]!.content).toEqual({
      type: 'element',
      elementId: 'e2',
      name: 'Launch',
    });
  });

  it('is read back from content, and only from a named kind', () => {
    expect(slotNameOf({ type: 'element', name: 'Launch' })).toBe('Launch');
    expect(slotNameOf({ type: 'element' })).toBeUndefined();
    expect(slotNameOf({ type: 'tab', name: 'Nope' })).toBeUndefined();
    expect(slotNameOf(undefined)).toBeUndefined();
  });

  it('is set trimmed, cleared when empty, and the same content when unchanged', () => {
    const plain: DashboardContent = { type: 'element', elementId: 'e1' };
    const named = withSlotName(plain, '  Launch ');
    expect(named).toEqual({ type: 'element', elementId: 'e1', name: 'Launch' });
    expect(withSlotName(named, 'Launch')).toBe(named);
    expect(withSlotName(named, '   ')).toEqual(plain);
    expect(withSlotName(plain, '')).toBe(plain);
    const note: DashboardContent = { type: 'note', title: 'A', text: 'B' };
    expect(withSlotName(note, 'Nope')).toBe(note);
  });
});
