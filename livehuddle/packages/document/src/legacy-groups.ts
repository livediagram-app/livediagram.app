// Loading a diagram saved while groups existed (docs/specs/009-elements/web-components-and-no-groups.md).
//
// Groups are gone, but stored tabs still carry their traces: a `groupId` on
// boxed elements. It runs at the boundaries where stored tabs enter (the api
// worker's `rowToTab` and the offline store's tab load) and drops `groupId`.
// An arrow end of kind `pinned-group` is left as stored: arrows are retired.

import type { Element } from './index';

const legacyGroupIdOf = (el: Element): string | undefined => {
  const gid = (el as { groupId?: unknown }).groupId;
  return typeof gid === 'string' ? gid : undefined;
};

// Whether a tab's elements carry anything to migrate. Cheap, so the common
// case (a diagram that never used groups) returns the same array untouched.
// A stored arrow is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part
// 4): it is kept exactly as stored, so an end it saved pinned to a group is left as it is (it draws at its other end).
export function hasLegacyGroups(elements: readonly Element[]): boolean {
  return elements.some((el) => el.type !== 'arrow' && legacyGroupIdOf(el) !== undefined);
}

export function migrateLegacyGroups(elements: Element[]): Element[] {
  if (!hasLegacyGroups(elements)) return elements;
  return elements.map((el) => {
    if (el.type === 'arrow' || legacyGroupIdOf(el) === undefined) return el;
    const { groupId: _drop, ...rest } = el as Element & { groupId?: string };
    return rest;
  });
}
