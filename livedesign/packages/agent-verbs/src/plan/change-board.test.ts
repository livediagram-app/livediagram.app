import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from '@livepages/items';
import { swimlanesNamed } from './change-board';

// change_board's swimlanes by name (docs/specs/026-plan/plan-agents.md "Changing a board").

const BUG: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'bug',
  label: 'Bug',
  fields: ['title', 'status', 'f-sev'],
  custom: [{ id: 'f-sev', label: 'Severity', kind: 'choice', options: ['S1', 'S2'] }],
};

describe('swimlanesNamed', () => {
  it('reads a built-in grouping, "column" as status', () => {
    expect(swimlanesNamed('Priority', ITEM_TYPES)).toEqual({ ok: true, value: { by: 'priority' } });
    expect(swimlanesNamed('column', ITEM_TYPES)).toEqual({ ok: true, value: { by: 'status' } });
    expect(swimlanesNamed('none', ITEM_TYPES)).toEqual({ ok: true, value: { by: 'none' } });
  });

  it('reads a field by its name', () => {
    expect(swimlanesNamed('severity', [...ITEM_TYPES, BUG])).toEqual({
      ok: true,
      value: { by: 'field', field: 'f-sev' },
    });
  });

  it('names only the built-in groupings when no field can group', () => {
    const r = swimlanesNamed('Mood', []);
    expect(!r.ok && r.message).toBe(
      'No swimlanes "Mood". Swimlanes: none, assignee, type, priority, status.',
    );
  });

  it('refuses anything else, naming what there is', () => {
    const r = swimlanesNamed('Mood', [...ITEM_TYPES, BUG]);
    expect(r).toMatchObject({ ok: false, code: 'board_invalid' });
    expect(!r.ok && r.message).toContain('Severity');
  });
});
