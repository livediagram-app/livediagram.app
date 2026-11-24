import { describe, expect, it } from 'vitest';
import { PAGE_DESIGN_BY_ID } from '@livedocuments/document';
import { another, picked, reset, shuffled, tuned, wornDesign } from './design-tune';
import { designTileSvg } from './design-tile-svg';
import { guardLine } from './DesignFineTune';
import { designRowValue } from './useDesignRow';

describe('the Page Design panel’s choices', () => {
  it('shows the tab design, or the page’s own over it', () => {
    const tab = { id: 'aurora' as const };
    expect(wornDesign('tab', tab, { id: 'waves' })).toBe(tab);
    expect(wornDesign('page', tab, undefined)).toBe(tab);
    expect(wornDesign('page', tab, { id: 'waves' })).toEqual({ id: 'waves' });
    expect(wornDesign('page', tab, { id: 'none' })).toBeUndefined();
  });

  it('keeps the switches a person set when another design is picked, and Reset keeps the design', () => {
    const was = {
      id: 'aurora' as const,
      colors: ['#112233', '#445566', '#778899'] as [string, string, string],
      rhythm: true as const,
      animate: true as const,
      intensity: 0.3,
    };
    const next = picked('waves', was);
    expect(next).toMatchObject({ id: 'waves', colors: was.colors, rhythm: true, animate: true });
    expect(next.intensity).toBeUndefined();
    // A design that cannot move drops Animate.
    expect(picked('dots', was).animate).toBeUndefined();
    expect(reset(was)).toEqual({ id: 'aurora', rhythm: true, animate: true });
  });

  it('shuffles to a new seed and tries the next design of the family', () => {
    const d = { id: 'aurora' as const, seed: 5 };
    expect(shuffled(d, () => 0.0004).seed).not.toBe(5);
    const next = another({ id: 'aurora', intensity: 0.4 });
    expect(next.id).not.toBe('aurora');
    expect(PAGE_DESIGN_BY_ID[next.id].family).toBe('gradients');
    expect(next.intensity).toBe(0.4);
    expect(tuned({ id: 'aurora', intensity: 0.4 }, 'intensity', undefined)).toEqual({
      id: 'aurora',
    });
  });

  it('draws a tile as one SVG and counts the texts a guard scrims or warns of', () => {
    const theme = {};
    const el = {
      id: 't',
      type: 'text',
      x: 100,
      y: 100,
      width: 600,
      height: 60,
      label: 'Hello',
      textColor: '#9ca3af',
    } as never;
    const scrim = designTileSvg({
      design: { id: 'diagonal-stripes', intensity: 1, calm: 0 },
      theme,
      paperDark: false,
      elements: [el],
      idPrefix: 'x-',
    });
    expect(scrim.svg.startsWith('<svg')).toBe(true);
    const warn = designTileSvg({
      design: { id: 'diagonal-stripes', intensity: 1, calm: 0, guard: 'warn' },
      theme,
      paperDark: false,
      elements: [el],
      idPrefix: 'x-',
    });
    expect(warn.scrimmed).toBe(0);
    expect(warn.failing).toBe(scrim.failing);
    expect(guardLine(true, 2, 0)).toBe('2 texts on this page are hard to read on this design.');
    expect(guardLine(false, 1, 1)).toBe('A scrim keeps 1 text on this page readable.');
    expect(guardLine(false, 0, 0)).toBe('Every text on this page reads clearly.');
  });

  it('names the tab design on the home row', () => {
    expect(designRowValue(undefined)).toBe('None');
    expect(designRowValue({ id: 'aurora', animate: true })).toBe('Aurora, Animated');
  });
});
