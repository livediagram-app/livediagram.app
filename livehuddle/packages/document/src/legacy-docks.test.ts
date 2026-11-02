import { describe, expect, it } from 'vitest';
import { dropLegacyDocks } from './legacy-docks';
import type { Element } from './index';

const event = { id: 'e', type: 'sticky', esKind: 'domain-event', x: 0, y: 0 } as Element;
const docked = {
  id: 'c',
  type: 'sticky',
  esKind: 'command',
  x: -216,
  y: 0,
  esDock: { hostId: 'e', side: 'before' },
} as unknown as Element;

describe('dropLegacyDocks', () => {
  it('drops a stored dock relation and leaves the note where it is', () => {
    const [, command] = dropLegacyDocks([event, docked]);
    expect(command).toEqual({ id: 'c', type: 'sticky', esKind: 'command', x: -216, y: 0 });
  });

  it('returns the SAME array when nothing carries a dock', () => {
    const els = [event];
    expect(dropLegacyDocks(els)).toBe(els);
  });

  it('leaves every element without a dock untouched, object identity included', () => {
    const out = dropLegacyDocks([event, docked]);
    expect(out[0]).toBe(event);
  });
});
