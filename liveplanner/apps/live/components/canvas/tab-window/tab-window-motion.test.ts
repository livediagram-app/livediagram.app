import { describe, expect, it } from 'vitest';
import { createArrow, createShape, type Element, type Tab } from '@liveplanner/document';
import { renderTabToSvg } from '@/lib/export-tab';
import { windowArrowLine, windowMotion } from './tab-window-motion';

const tab = (elements: Element[]): Tab => ({ id: 't', name: 'Shown', elements });

// docs/specs/009-elements/tab-window.md "The drawing": the shown tab's arrows flow in the window.
describe('windowArrowLine', () => {
  const arrow = (extra: object) => ({ ...createArrow(0, 0, 100, 0), id: 'a', ...extra });

  it('draws a marching flow with its own dashes', () => {
    expect(windowArrowLine(arrow({ flow: 'dashes' }), 'light')).toMatchObject({
      className: 'lvd-arrow-flow',
      dash: '8 6',
    });
  });

  it('measures a draw reveal in 0..1', () =>
    expect(windowArrowLine(arrow({ flow: 'draw' }), 'light')?.pathLength).toBe(1));

  it('holds still with no flow, and for a travelling dot', () => {
    expect(windowArrowLine(arrow({}), 'light')).toBeUndefined();
    expect(windowArrowLine(arrow({ flow: 'dots' }), 'light')).toBeUndefined();
  });
});

describe('renderTabToSvg with motion', () => {
  const shown = tab([
    { ...createShape('square', 0, 0), id: 'b' },
    { ...createArrow(0, 0, 100, 0), id: 'a', flow: 'dashes' },
  ]);

  it('sets the flow on the line', () => {
    const svg = renderTabToSvg(shown, { motion: windowMotion('light') });
    expect(svg).toContain('class="lvd-arrow-flow"');
    expect(svg).toContain('stroke-dasharray="8 6"');
  });

  it('stays a still without it, as every file export is', () => {
    const svg = renderTabToSvg(shown);
    expect(svg).not.toContain('lvd-arrow-flow');
  });
});
