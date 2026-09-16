import { describe, expect, it } from 'vitest';
import { afterElementsRemoved } from './element-removal';
import type { ArrowElement, Element, StickyElement } from './index';

// The one healing pass every deletion path runs. Its two jobs are tested in
// full beside their own modules (groups.test.ts, event-storming-dock.test.ts);
// what is asserted here is that BOTH of them run, from one call.

const host: StickyElement = {
  id: 'h',
  type: 'sticky',
  esKind: 'domain-event',
  fixedSize: true,
  x: 0,
  y: 0,
  width: 200,
  height: 200,
} as StickyElement;

const docked: StickyElement = {
  ...host,
  id: 'd',
  esKind: 'command',
  x: -216,
  esDock: { hostId: 'h', side: 'before' },
} as StickyElement;

const member: Element = {
  id: 'm',
  type: 'shape',
  shape: 'square',
  x: 400,
  y: 0,
  width: 100,
  height: 100,
  groupId: 'g1',
} as Element;

const pinned: ArrowElement = {
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 800, y: 50 },
  to: { kind: 'pinned-group', groupId: 'g1', anchor: 'w' },
} as ArrowElement;

describe('afterElementsRemoved', () => {
  it('heals both a dangling dock and a dangling group pin in one pass', () => {
    const before: Element[] = [host, docked, member, pinned];
    const after = afterElementsRemoved(
      before,
      before.filter((el) => el.id !== 'h' && el.id !== 'm'),
    );
    expect('esDock' in (after.find((el) => el.id === 'd') as StickyElement)).toBe(false);
    expect((after.find((el) => el.id === 'a') as ArrowElement).to.kind).toBe('free');
  });

  it('leaves an untouched board alone, object identity included', () => {
    const before: Element[] = [host, docked];
    expect(afterElementsRemoved(before, before)).toBe(before);
  });
});
