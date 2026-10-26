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

// docs/specs/008-canvas/arrow-to-arrow.md: a pasted arrow ends on an arrow that is on the tab, never on one that
// stayed on the clipboard. A connector copied without its boxes cannot land on another tab, and an arrow hung off it
// used to land anyway, its end naming the connector's clipboard id (drawn at the canvas origin, and saved).
describe('duplicateElements onto another tab (a paste)', () => {
  const connector = {
    id: 'x',
    type: 'arrow',
    from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
    to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
  } as Element;
  const hungTo = { kind: 'on-arrow', arrowId: 'x', t: 0.5 } as const;
  const hung = {
    id: 'y',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: hungTo,
  } as Element;

  it('lands no arrow hung off a clipboard arrow that did not land', () => {
    const ids = new Set(['x', 'y']);
    expect(duplicateElements([connector, hung], ids, 10, 10, new Set()).newElements).toEqual([]);
  });

  it("keeps an end on an original that is on the tab (a duplicate's default)", () => {
    const { newElements } = duplicateElements([connector, hung], new Set(['y']), 10, 10);
    expect(newElements).toHaveLength(1);
    expect((newElements[0] as { to: unknown }).to).toEqual(hungTo);
  });
});
