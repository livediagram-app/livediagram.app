import { describe, expect, it } from 'vitest';
import { withoutApiOnlyFields } from './room-api-only-fields';

// The fields only the api sends through the room: a client socket's op loses them, the rest relays as sent.

const strip = <T>(op: T): T => {
  withoutApiOnlyFields(op);
  return op;
};

describe('withoutApiOnlyFields', () => {
  it('drops the settings and the style from a document-meta', () => {
    expect(
      strip({
        kind: 'document-meta',
        name: 'K',
        tabs: [],
        knowledgeSettings: { reviewEvery: 30 },
        knowledgeStyle: { theme: 'ink' },
      }),
    ).toEqual({ kind: 'document-meta', name: 'K', tabs: [] });
  });

  it('drops knowledge from a tab-meta patch and its clear list, keeping what else it clears', () => {
    expect(
      strip({
        kind: 'tab-meta',
        tabId: 't1',
        patch: { name: 'x', knowledge: { verifiedAt: 1 } },
        clear: ['knowledge', 'cover'],
      }),
    ).toEqual({ kind: 'tab-meta', tabId: 't1', patch: { name: 'x' }, clear: ['cover'] });
    expect(strip({ kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['knowledge'] })).toEqual({
      kind: 'tab-meta',
      tabId: 't1',
      patch: {},
    });
  });

  it('drops knowledge from a whole tab', () => {
    expect(
      strip({
        kind: 'tab',
        tabId: 't1',
        tab: { id: 't1', elements: [], knowledge: { owner: 'a' } },
      }),
    ).toEqual({ kind: 'tab', tabId: 't1', tab: { id: 't1', elements: [] } });
  });

  it('leaves every other op, and a malformed one, as it is', () => {
    const el = { kind: 'el', tabId: 't1', op: { kind: 'remove', id: 'a', knowledge: 1 } };
    expect(strip(structuredClone(el))).toEqual(el);
    expect(strip({ kind: 'tab-meta', tabId: 't1', patch: null, clear: 'knowledge' })).toEqual({
      kind: 'tab-meta',
      tabId: 't1',
      patch: null,
      clear: 'knowledge',
    });
    expect(strip({ kind: 'tab', tabId: 't1', tab: null })).toEqual({
      kind: 'tab',
      tabId: 't1',
      tab: null,
    });
    expect(strip(null)).toBeNull();
    expect(strip('op')).toBe('op');
  });
});
