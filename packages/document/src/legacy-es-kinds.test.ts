import { describe, expect, it } from 'vitest';
import { eventStormingKindOf } from './event-storming';
import type { Element } from './index';
import { stampLegacyEsKinds } from './legacy-es-kinds';
import { migrateStoredTab } from './stored-tab';

const sticky = (over: Record<string, unknown> = {}) =>
  ({ id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200, ...over }) as Element;

// docs/specs/021-event-storming/event-storming.md "The kind is stored": a note from before the stamp gets its kind
// from its canonical fill once, as it loads; after that the colour is never read again.
describe('stampLegacyEsKinds', () => {
  it('stamps a fixed-size sticky in a canonical fill with its kind', () => {
    const [out] = stampLegacyEsKinds([sticky({ fixedSize: true, fillColor: '#fef08a' })]);
    expect(out).toMatchObject({ esKind: 'actor' });
  });

  it('leaves a stored kind, a free sticky and an off-catalogue fill alone (same array)', () => {
    const els = [
      sticky({ fixedSize: true, fillColor: '#fef08a', esKind: 'command' }),
      sticky({ fillColor: '#fef08a' }),
      sticky({ fixedSize: true, fillColor: '#123456' }),
      sticky({ fixedSize: true }),
    ];
    expect(stampLegacyEsKinds(els)).toBe(els);
  });

  it('runs on every stored-tab entry point', () => {
    const tab = migrateStoredTab({
      elements: [sticky({ fixedSize: true, fillColor: '#93c5fd' })],
    });
    expect(tab.elements[0]).toMatchObject({ esKind: 'command' });
  });

  it('keeps a plain sticky plain when it is recoloured Lemon after loading', () => {
    const [plain] = migrateStoredTab({
      elements: [sticky({ fixedSize: true, fillColor: '#ffffff' })],
    }).elements;
    const recoloured = { ...plain!, fillColor: '#fef08a' } as Element;
    expect(eventStormingKindOf(recoloured)).toBeNull();
  });
});
