import { describe, expect, it } from 'vitest';
import { createShape, type Element } from './index';
import { sessionMembers, stampSessionMembers } from './component-session';
import { duplicateElements, freshCopyFields } from './duplicate';

const carrying = (): Element =>
  ({
    ...createShape('square', 0, 0),
    id: 'orig',
    commentThread: { comments: [{ id: 'c1', authorId: 'u1', text: 'Hi', createdAt: 1 }] },
    action: { id: 'act-1', assignerId: 'u1', title: 'Do it' },
    actions: [{ id: 'act-2', assignerId: 'u1', title: 'And this' }],
  }) as unknown as Element;

// docs/specs/012-collaboration/assigned-actions.md "A copy doesn't carry the action"
describe('freshCopyFields', () => {
  it("drops the original's comments and actions from a duplicate", () => {
    const { newElements } = duplicateElements([carrying()], new Set(['orig']), 10, 10);
    const copy = JSON.parse(JSON.stringify(newElements[0])) as Record<string, unknown>;
    expect(copy.commentThread).toBeUndefined();
    expect(copy.action).toBeUndefined();
    expect(copy.actions).toBeUndefined();
  });

  // docs/specs/009-elements/components.md "Editing the main: the edit session": a copy of a member is a new member,
  // never a second element under the member's main id.
  it('drops the edit session marks, so a copy made in a session joins it as a new member', () => {
    const instance = {
      ...createShape('square', 0, 0),
      shape: 'instance',
      componentId: 'main',
      id: 'inst',
      componentEditBy: 'me',
    } as unknown as Element;
    const member = {
      ...createShape('square', 0, 0),
      id: 'inst-m1',
      componentMember: { instanceId: 'inst', elementId: 'm1' },
    } as unknown as Element;
    const tab = [instance, member];
    const { newElements } = duplicateElements(tab, new Set(['inst', 'inst-m1']), 10, 10);
    for (const c of newElements) {
      expect(c.componentMember).toBeUndefined();
      expect((c as { componentEditBy?: string }).componentEditBy).toBeUndefined();
    }
    // The member alone copied (Cmd+D in the session) joins it under its own id.
    const copy = duplicateElements(tab, new Set(['inst-m1']), 10, 10).newElements[0]!;
    const next = stampSessionMembers(tab, [...tab, copy]);
    expect(next.at(-1)!.componentMember).toEqual({ instanceId: 'inst', elementId: copy.id });
    const ids = sessionMembers(next, 'inst').map((m) => m.componentMember!.elementId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('adds no keys an element never had', () => {
    expect(freshCopyFields(createShape('square', 0, 0))).toEqual({});
  });
});
