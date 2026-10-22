import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { changeItemsShape } from './plan-schema';

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
