import { describe, expect, it } from 'vitest';
import {
  createArrow,
  createShape,
  createSticky,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/document';
import { renderTabToSvg } from '@/lib/export-tab';
import {
  WINDOW_SHAPE_PLAYS,
  windowArrowLine,
  windowBoxedMotion,
  windowMotion,
} from './tab-window-motion';

const box = (animation?: string, extra: Partial<BoxedElement> = {}) =>
  ({ ...createShape('square', 0, 0), id: 'b', animation, ...extra }) as BoxedElement;
const sticky = (animation: string) =>
  ({ ...createSticky(0, 0), id: 's', animation }) as BoxedElement;
const tab = (elements: Element[]): Tab => ({ id: 't', name: 'Shown', elements });

// docs/specs/009-elements/tab-window.md "The drawing": the shown tab's animations play in the window.
describe('windowBoxedMotion', () => {
  it('plays every Shape motion and filter swell by the canvas class', () => {
    for (const value of WINDOW_SHAPE_PLAYS) {
      expect(windowBoxedMotion(box(value), 'light')?.className).toBe(`lvd-anim-${value}`);
    }
  });

  it('holds still for the effects that need the canvas’s own layers', () => {
    for (const value of ['pulse', 'glow', 'trace', 'gradient'])
      expect(windowBoxedMotion(box(value), 'light')).toBeUndefined();
    expect(windowBoxedMotion(box(), 'light')).toBeUndefined();
  });

  it('plays a sticky’s whole-note motions, and a shared Shape swell, but not its fold', () => {
    expect(windowBoxedMotion(sticky('flutter'), 'light')?.className).toBe('lvd-note-flutter');
    expect(windowBoxedMotion(sticky('highlight'), 'light')?.className).toBe('lvd-anim-highlight');
    expect(windowBoxedMotion(sticky('peel'), 'light')).toBeUndefined();
  });

  it('marks a reveal that does not repeat as play-once', () => {
    const drop = { ...sticky('drop'), animationRepeat: false } as BoxedElement;
    expect(windowBoxedMotion(drop, 'light')?.className).toBe('lvd-note-drop lvd-once');
  });

  it('sets the speed, size and repeat the stylesheets read', () => {
    const m = windowBoxedMotion(
      box('bounce', { width: 120, height: 80, animationSpeed: 'fast', animationRepeat: false }),
      'light',
    );
    expect(m?.style).toContain('--lvd-anim-size:80');
    expect(m?.style).toContain('--lvd-anim-speed:0.5');
    expect(m?.style).toContain('--lvd-anim-iter:1');
  });
});

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
  const shown = tab([box('bounce'), { ...createArrow(0, 0, 100, 0), id: 'a', flow: 'dashes' }]);

  it('wraps a moving element in its class and sets the flow on the line', () => {
    const svg = renderTabToSvg(shown, { motion: windowMotion('light') });
    expect(svg).toContain('<g class="lvd-svg-motion lvd-anim-bounce" style="--lvd-anim-color:');
    expect(svg).toContain('class="lvd-arrow-flow"');
    expect(svg).toContain('stroke-dasharray="8 6"');
  });

  it('stays a still without it, as every file export is', () => {
    const svg = renderTabToSvg(shown);
    expect(svg).not.toContain('lvd-svg-motion');
    expect(svg).not.toContain('lvd-arrow-flow');
  });
});
