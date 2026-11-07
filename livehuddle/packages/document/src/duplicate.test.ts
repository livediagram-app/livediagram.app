import { describe, expect, it } from 'vitest';
import { createShape, type Element } from './index';
import { duplicateElements, freshCopyFields } from './duplicate';

const carrying = (): Element =>
  ({
    ...createShape('square', 0, 0),
    id: 'orig',
    commentThread: { comments: [{ id: 'c1', authorId: 'u1', text: 'Hi', createdAt: 1 }] },
    responses: [{ participantId: 'u1', value: '3', at: 1 }],
    action: { id: 'act-1', assignerId: 'u1', title: 'Do it' },
    actions: [{ id: 'act-2', assignerId: 'u1', title: 'And this' }],
  }) as unknown as Element;

// docs/specs/012-collaboration/assigned-actions.md "A copy doesn't carry the action"
describe('freshCopyFields', () => {
  it("drops the original's comments and actions from a duplicate", () => {
    const { newElements } = duplicateElements([carrying()], new Set(['orig']), 10, 10);
    const copy = JSON.parse(JSON.stringify(newElements[0])) as Record<string, unknown>;
    expect(copy.commentThread).toBeUndefined();
    // A retired element's stored answers (docs/specs/002-project-scope/not-in-livehuddle.md) were people's, not the copy's.
    expect(copy.responses).toBeUndefined();
    expect(copy.action).toBeUndefined();
    expect(copy.actions).toBeUndefined();
  });

  it('starts a copied Arcade Machine\'s High Scores empty (social-pieces.md "Copies")', () => {
    const machine = {
      ...createShape('arcade-machine', 0, 0),
      id: 'arcade',
      arcadeScores: [{ id: 's1', name: 'Ann', score: 10, ms: 5000, by: 'k', at: 1 }],
    } as Element;
    const { newElements } = duplicateElements([machine], new Set(['arcade']), 10, 10);
    const copy = JSON.parse(JSON.stringify(newElements[0])) as Record<string, unknown>;
    expect(copy.arcadeScores).toBeUndefined();
    expect(copy.shape).toBe('arcade-machine');
  });

  it('adds no keys an element never had', () => {
    expect(freshCopyFields(createShape('square', 0, 0))).toEqual({});
  });
});
