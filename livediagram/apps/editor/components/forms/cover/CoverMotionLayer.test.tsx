// @vitest-environment jsdom

// A form cover's animated background on screen (docs/specs/030-forms/forms.md "The form card, top to bottom",
// Cover): the parts of lib/form-cover/cover-motion-parts.ts drawn as moving DOM.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PageMotion } from '@/lib/form-cover/colour-background';
import { PAGE_MOTION_CATALOGUE } from '@/lib/form-cover/cover-motion';
import { CoverMotionLayer } from './CoverMotionLayer';

afterEach(cleanup);

const fill = { from: '#1e3a8a', to: '#4c1d95' };
const layer = (motion: PageMotion, speed?: number) =>
  render(
    <CoverMotionLayer
      motion={motion}
      fill={speed ? { ...fill, speed } : fill}
      width={1920}
      height={1080}
    />,
  ).container.querySelector<HTMLElement>('[data-cover-motion]')!;

describe('CoverMotionLayer', () => {
  it.each(PAGE_MOTION_CATALOGUE.map((m) => m.id))(
    'draws %s, hidden from assistive tech',
    (motion) => {
      const el = layer(motion);
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(el.childElementCount).toBeGreaterThan(0);
    },
  );

  it('runs the whole motion at the slide speed', () => {
    expect(layer('aurora', 2).style.getPropertyValue('--pm-rate')).toBe('2');
  });

  it('heads each Warp streak its own way, fading in from its tail', () => {
    const streaks = layer('warp').querySelectorAll<HTMLElement>('.pm-warp');
    expect(streaks.length).toBe(48);
    expect(streaks[0]!.style.getPropertyValue('--pm-r')).toMatch(/deg$/);
    expect(streaks[0]!.style.background).toContain('linear-gradient(90deg, transparent');
  });

  it('turns the radar sweep as a conic wedge, and orbits as groups', () => {
    const sweep = layer('radar').querySelector<HTMLElement>('.pm-turn')!;
    expect(sweep.style.background).toContain('conic-gradient');
    expect(layer('orbits').querySelectorAll('.pm-orbit').length).toBeGreaterThan(4);
  });

  it('lights equaliser bars from below', () => {
    const bar = layer('equaliser').querySelector<HTMLElement>('.pm-bars')!;
    expect(bar.style.background).toContain('linear-gradient(0deg');
    expect(bar.style.getPropertyValue('--pm-rest')).not.toBe('');
  });

  it('strokes threads as lines and fills waves as water', () => {
    const thread = layer('threads').querySelector('path')!;
    expect(thread.getAttribute('fill')).toBe('none');
    expect(Number(thread.getAttribute('stroke-width'))).toBeGreaterThan(0);
    expect(layer('waves').querySelector('path')!.getAttribute('fill')).not.toBe('none');
  });
});
