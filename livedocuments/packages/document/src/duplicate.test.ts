import { describe, expect, it } from 'vitest';
import { createShape, type Element } from './index';
import { duplicateElements, freshCopyFields } from './duplicate';

const carrying = (): Element =>
  ({
    ...createShape('square', 0, 0),
    id: 'orig',
    commentThread: { comments: [{ id: 'c1', authorId: 'u1', text: 'Hi', createdAt: 1 }] },
    action: { id: 'act-1', assignerId: 'u1', title: 'Do it' },
  }) as unknown as Element;

// docs/specs/012-collaboration/assigned-actions.md "A copy doesn't carry the action"
describe('freshCopyFields', () => {
  it("drops the original's comments and actions from a duplicate", () => {
    const { newElements } = duplicateElements([carrying()], new Set(['orig']), 10, 10);
    const copy = JSON.parse(JSON.stringify(newElements[0])) as Record<string, unknown>;
    expect(copy.commentThread).toBeUndefined();
    expect(copy.action).toBeUndefined();
  });

  it('adds no keys an element never had', () => {
    expect(freshCopyFields(createShape('square', 0, 0))).toEqual({});
  });
});
