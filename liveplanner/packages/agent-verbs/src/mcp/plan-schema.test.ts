import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cardTypeChangeSchema, changeBoardShape, changeItemsShape } from './plan-schema';

// docs/specs/026-plan/plan-agents.md "Unknown names are refused, never stored": a key a change does not take is
// refused too, so a card never quietly lands somewhere other than asked.
const changes = z.object(changeItemsShape).shape.changes;

describe('change_items changes', () => {
  it('takes a column by its status', () => {
    expect(changes.safeParse([{ op: 'add', title: 'Write notes', status: 'To Do' }]).success).toBe(
      true,
    );
  });

  it('refuses a key a change does not take, naming it, rather than dropping it', () => {
    const parsed = changes.safeParse([{ op: 'add', title: 'Write notes', column: 'To Do' }]);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain('column');
    expect(
      changes.safeParse([{ op: 'move', item: '#1', status: 'Done', colum: 'x' }]).success,
    ).toBe(false);
  });
});

// docs/specs/026-plan/plan-agents.md "Changing a board" and "Changing card types": the card sizes are Minimal and
// Detailed; an older prompt's retired Compact still works, read as Detailed (a board) or skipped (a display).
describe('card sizes', () => {
  const board = z.object(changeBoardShape);

  it('offers only minimal and detailed', () => {
    const cardSize = z.toJSONSchema(board, { io: 'input' }).properties?.['cardSize'];
    expect(cardSize).toMatchObject({ enum: ['minimal', 'detailed'] });
    const types = JSON.stringify(z.toJSONSchema(cardTypeChangeSchema, { io: 'input' }));
    expect(types).not.toContain('compact');
    expect(types).toContain('minimal');
  });

  it('reads a board sent as compact as detailed', () => {
    expect(board.parse({ projectId: 'p', board: 'Sprint', cardSize: 'compact' }).cardSize).toBe(
      'detailed',
    );
    expect(board.parse({ projectId: 'p', board: 'Sprint', cardSize: 'minimal' }).cardSize).toBe(
      'minimal',
    );
    expect(board.safeParse({ projectId: 'p', board: 'Sprint', cardSize: 'huge' }).success).toBe(
      false,
    );
  });

  it('skips a display’s compact layout rather than refusing the change', () => {
    const parsed = cardTypeChangeSchema.parse({
      op: 'add',
      name: 'Bug',
      display: { compact: { besideTitle: ['Number'] }, minimal: { afterTitle: ['Assignee'] } },
    });
    expect(parsed.op === 'add' && parsed.display).toEqual({
      minimal: { afterTitle: ['Assignee'] },
    });
  });
});
