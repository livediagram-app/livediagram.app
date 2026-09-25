import { describe, expect, it } from 'vitest';
import { afterElementsRemoved } from './element-removal';
import type { Element, StickyElement } from './index';

// The one healing pass every deletion path runs. Its job is tested in full
// beside its own module (event-storming-dock.test.ts); what is asserted here
// is that it runs, from one call.

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

describe('afterElementsRemoved', () => {
  it('heals a dock whose host was removed', () => {
    const before: Element[] = [host, docked];
    const after = afterElementsRemoved(before.filter((el) => el.id !== 'h'));
    expect('esDock' in (after.find((el) => el.id === 'd') as StickyElement)).toBe(false);
  });

  it('leaves an untouched board alone, object identity included', () => {
    const before: Element[] = [host, docked];
    expect(afterElementsRemoved(before)).toBe(before);
  });
});
