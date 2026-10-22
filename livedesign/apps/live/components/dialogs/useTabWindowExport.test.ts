import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livedesign/document';
import { renderTabToSvg } from '@/lib/export-tab';
import { tabWindowArts, tabWindowTargets } from './useTabWindowExport';

// docs/specs/009-elements/tab-window.md "Exports".

const box = (id: string, label: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 120,
  height: 60,
  label,
});
const win = (id: string, windowTabId?: string): Element => ({
  id,
  type: 'shape',
  shape: 'tab-window',
  x: 0,
  y: 0,
  width: 640,
  height: 360,
  ...(windowTabId ? { windowTabId } : {}),
});
const tab = (id: string, name: string, elements: Element[], extra: Partial<Tab> = {}) => ({
  id,
  name,
  elements,
  ...extra,
});

describe('tabWindowTargets', () => {
  it('names each tab its windows show once, never its own, skipping unchosen windows', () => {
    const t = tab('slides', 'Slides', [
      win('a', 'flow'),
      win('b', 'flow'),
      win('c'),
      win('d', 'slides'),
      win('e', 'arch'),
    ]);
    expect(tabWindowTargets(t)).toEqual(['flow', 'arch']);
  });
});

describe('tabWindowArts', () => {
  const tabs = [
    tab('slides', 'Slides', []),
    tab('flow', 'Flow', [box('n1', 'Checkout'), win('inner', 'slides')]),
    tab('blank', 'Blank', []),
    tab('board', 'Board', [box('x', 'x')], { kind: 'board' }),
  ];

  it('draws a shown tab, a window inside it its named frame', () => {
    const arts = tabWindowArts('slides', ['flow'], tabs, new Map());
    const flow = arts.get('flow')!;
    expect(flow.name).toBe('Flow');
    expect(flow.drawing?.markup).toContain('Checkout');
    // No recursion: the window on Flow showing Slides is its frame, named.
    expect(flow.drawing?.markup).toContain('>Slides<');
    expect(flow.drawing!.width).toBeGreaterThan(0);
  });

  it('names an empty tab without a drawing, draws a Plan tab, and leaves out its own tab and a gone one', () => {
    const arts = tabWindowArts('slides', ['blank', 'board', 'slides', 'gone'], tabs, new Map());
    expect(arts.get('blank')).toEqual({ name: 'Blank' });
    expect(arts.has('board')).toBe(true);
    expect(arts.has('slides')).toBe(false);
    expect(arts.has('gone')).toBe(false);
  });

  it('draws a Pages tab as its pages, a Form tab as its form and a Board tab laid out', () => {
    const shown = [
      ...tabs,
      tab('deck', 'Deck', [], { opensIn: 'pages' }),
      tab('survey', 'Survey', [], {
        kind: 'form',
        form: { v: 1, heading: 'Team Survey', sections: [{ id: 's', title: '', questions: [] }] },
      }),
    ];
    const arts = tabWindowArts('slides', ['deck', 'survey'], shown, new Map());
    expect(arts.get('deck')?.drawing?.markup).toContain('<svg x="');
    expect(arts.get('survey')?.drawing?.markup).toContain('Team Survey');
    // A Board tab is its board alone (planImageOf), never the canvas's other elements.
    const board = tab(
      'board',
      'Board',
      [{ ...box('b', ''), shape: 'plan-board' } as Element, box('loose', 'Loose Note')],
      { kind: 'board' },
    );
    const boardArt = tabWindowArts('slides', ['board'], [...tabs.slice(0, 3), board], new Map());
    expect(boardArt.get('board')?.drawing?.markup).not.toContain('Loose Note');
  });

  it('puts the drawing inside the window in the tab export', () => {
    const arts = tabWindowArts('slides', ['flow'], tabs, new Map());
    const slides = tab('slides', 'Slides', [win('w', 'flow')]);
    const svg = renderTabToSvg(slides, {
      resolveTabWindow: (el) => (el.windowTabId ? arts.get(el.windowTabId) : undefined),
    });
    expect(svg).toContain('Checkout');
    expect(svg).toContain('clip-path="url(#tw-w-clip)"');
  });
});
