import { describe, expect, it } from 'vitest';
import { remapElementRefs, remapTabLinks } from './id-remap';

const idMap = new Map([
  ['a', 'a2'],
  ['b', 'b2'],
]);

describe('remapElementRefs', () => {
  it('re-points pinned and on-arrow ends and leaves free ends and unmapped ids alone', () => {
    const arrow = {
      id: 'x',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', side: 'left' },
      to: { kind: 'on-arrow', arrowId: 'b', t: 0.5 },
    };
    const [out] = remapElementRefs([arrow], idMap, []);
    expect(out).toEqual({
      ...arrow,
      from: { kind: 'pinned', elementId: 'a2', side: 'left' },
      to: { kind: 'on-arrow', arrowId: 'b2', t: 0.5 },
    });
    const still = {
      id: 'y',
      type: 'arrow',
      from: { kind: 'free', x: 1, y: 2 },
      to: { kind: 'pinned', elementId: 'zz' },
    };
    expect(remapElementRefs([still], idMap, [])[0]).toBe(still);
    const half = { ...still, to: { kind: 'on-arrow', arrowId: 'zz' } };
    expect(remapElementRefs([half], idMap, [])[0]).toBe(half);
  });

  it("re-points the product's reference fields on any other element", () => {
    const badge = { id: 'c', type: 'shape', attachedTo: 'a', mindParentId: 'b', portalTarget: 'q' };
    expect(
      remapElementRefs([badge], idMap, ['attachedTo', 'mindParentId', 'portalTarget'])[0],
    ).toEqual({
      ...badge,
      attachedTo: 'a2',
      mindParentId: 'b2',
    });
    // A field the product does not list is not touched.
    expect(remapElementRefs([badge], idMap, ['attachedTo'])[0]).toEqual({
      ...badge,
      attachedTo: 'a2',
    });
    const plain = { id: 'd', type: 'text', attachedTo: 'zz' };
    expect(remapElementRefs([plain], idMap, ['attachedTo', 'mindParentId'])[0]).toBe(plain);
  });

  it('is the same array when nothing was renamed', () => {
    const elements = [{ id: 'a', type: 'shape', attachedTo: 'b' }];
    expect(remapElementRefs(elements, new Map(), ['attachedTo'])).toBe(elements);
  });
});

describe('remapTabLinks', () => {
  const tabIdMap = new Map([['t1', 't9']]);

  it("re-points tab and element links and a Tab Window's tab", () => {
    const linked = { id: 'a', link: { kind: 'element', tabId: 't1', elementId: 'e' } };
    const tabLink = { id: 'b', link: { kind: 'tab', tabId: 't1' } };
    const windowed = { id: 'c', windowTabId: 't1' };
    expect(remapTabLinks([linked, tabLink, windowed], tabIdMap)).toEqual([
      { id: 'a', link: { kind: 'element', tabId: 't9', elementId: 'e' } },
      { id: 'b', link: { kind: 'tab', tabId: 't9' } },
      { id: 'c', windowTabId: 't9' },
    ]);
  });

  it('leaves links out of the file, unmapped tabs and unlinked elements alone', () => {
    const elements = [
      { id: 'a', link: { kind: 'url', url: 'https://example.com' } },
      { id: 'b', link: { kind: 'tab', tabId: 't2' } },
      { id: 'c', windowTabId: 't2' },
      { id: 'd' },
    ];
    remapTabLinks(elements, tabIdMap).forEach((el, i) => expect(el).toBe(elements[i]));
  });
});
