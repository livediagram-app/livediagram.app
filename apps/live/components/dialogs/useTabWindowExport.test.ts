import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
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

  it('names an empty tab without a drawing, and leaves out a tab a window may not show', () => {
    const arts = tabWindowArts('slides', ['blank', 'board', 'gone'], tabs, new Map());
    expect(arts.get('blank')).toEqual({ name: 'Blank' });
    expect(arts.has('board')).toBe(false);
    expect(arts.has('gone')).toBe(false);
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
