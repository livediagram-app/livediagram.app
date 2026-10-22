import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import type { ImportedPage } from '@/lib/drawio/import';
import { applyDrawioPages } from './drawio-apply';

const createTab = (name: string): Tab => ({
  id: 'fresh',
  name,
  elements: [],
  defaultTextSize: 'sm',
});
const box = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
});
const page = (tabId: string, name: string, over: Partial<ImportedPage> = {}): ImportedPage => ({
  tabId,
  name,
  elements: [box(`${tabId}-el`)],
  ...over,
});

const tabs: Tab[] = [
  { id: 'a', name: 'First', elements: [box('old-a')] },
  {
    id: 'b',
    name: 'Board',
    elements: [box('old-b')],
    theme: 'ocean',
    font: 'lora',
    folder: 'Plans',
    backgroundPattern: 'grid',
  },
  { id: 'c', name: 'Last', elements: [] },
];

describe('applyDrawioPages', () => {
  it('replaces the active tab and keeps its name for a single page', () => {
    const next = applyDrawioPages(tabs, 'b', [page('b', 'Page-1')], createTab);
    expect(next.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(next[1]).toMatchObject({ name: 'Board', elements: [box('b-el')], theme: 'ocean' });
    expect(next[0]).toBe(tabs[0]);
  });

  it('adds a tab per further page after the active one, named after the pages', () => {
    const next = applyDrawioPages(
      tabs,
      'b',
      [
        page('b', 'Overview'),
        page('t2', 'Detail', { backgroundColor: '#fafaf5' }),
        page('t3', ' '),
      ],
      createTab,
    );
    expect(next.map((t) => [t.id, t.name])).toEqual([
      ['a', 'First'],
      ['b', 'Overview'],
      ['t2', 'Detail'],
      ['t3', 'Page 3'],
      ['c', 'Last'],
    ]);
    expect(next[2]).toMatchObject({
      elements: [box('t2-el')],
      theme: 'ocean',
      font: 'lora',
      folder: 'Plans',
      backgroundPattern: 'grid',
      backgroundColor: '#fafaf5',
      templateChosen: true,
      defaultTextSize: 'sm',
    });
  });

  it('lands only elements the api will save (board-import.md "What lands")', () => {
    const arrow = {
      id: 'zero',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 0 },
      label: '\n',
      labelMaxWidth: 0,
    } as unknown as Element;
    const next = applyDrawioPages(
      tabs,
      'b',
      [page('b', 'P', { elements: [box('ok'), arrow, box('ok')] })],
      createTab,
    );
    expect(next[1]!.elements.map((e) => e.id)).toEqual(['ok']);
  });

  it('carries layers', () => {
    const layers = [
      { id: 'layer:default', name: 'Layer 1' },
      { id: 'layer:x', name: 'Notes', visible: false },
    ];
    const next = applyDrawioPages(tabs, 'a', [page('a', 'P', { layers })], createTab);
    expect(next[0]!.layers).toEqual(layers);
  });

  it('leaves the tabs alone when the active tab is gone or nothing came in', () => {
    expect(applyDrawioPages(tabs, 'zzz', [page('x', 'P')], createTab)).toBe(tabs);
    expect(applyDrawioPages(tabs, 'a', [], createTab)).toBe(tabs);
  });
});
