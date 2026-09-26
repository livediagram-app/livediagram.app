import { describe, expect, it } from 'vitest';
import { remapTabDataLinks } from './diagrams';

// copyDiagram re-points a copied tab's internal links at the copy's own tabs.
describe('remapTabDataLinks', () => {
  const map = new Map([['t1', 'T1']]);

  it('rewrites tab and element links to the copy tab ids', () => {
    const data = JSON.stringify({
      elements: [
        { id: 'a', type: 'shape', link: { kind: 'tab', tabId: 't1' } },
        { id: 'b', type: 'shape', link: { kind: 'element', tabId: 't1', elementId: 'a' } },
        { id: 'c', type: 'shape', link: { kind: 'diagram', diagramId: 'd', name: 'D' } },
      ],
      background: 'dots',
    });
    const out = JSON.parse(remapTabDataLinks(data, map));
    expect(out.background).toBe('dots');
    expect(out.elements.map((e: { link: unknown }) => e.link)).toEqual([
      { kind: 'tab', tabId: 'T1' },
      { kind: 'element', tabId: 'T1', elementId: 'a' },
      { kind: 'diagram', diagramId: 'd', name: 'D' },
    ]);
  });

  it('copies link-free and unparseable data byte for byte', () => {
    const plain = '{"elements":[{"id":"a","type":"shape"}]}';
    expect(remapTabDataLinks(plain, map)).toBe(plain);
    expect(remapTabDataLinks('{"tabId" nope', map)).toBe('{"tabId" nope');
  });
});
