import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AutomationsBoard } from './hero-automations-board';
import { PlanBoard } from './hero-plan-board';
import { TogetherBoard } from './hero-together-board';

// docs/specs/019-marketing/marketing-site.md "Hero": each board's cards pop in one after another, the cards that stay
// put column by column and the carried ones after them. PR #1771 (Work Tracker 856) rewrote the render-time counters
// that set those delays as lookups; Work Tracker 893 pins every pop-in delay to the values the counters gave before it.

// Every `hm-pop` group's delay (`--d`), in markup order, to the hundredth of a second.
const popDelays = (el: ReactElement) =>
  [...renderToStaticMarkup(el).matchAll(/class="hm-pop[^"]*" style="--d:([\d.]+)s/g)].map(
    (m) => Math.round(Number(m[1]) * 100) / 100,
  );

describe('the hero boards pop their cards in the order they always did', () => {
  it('Plan', () => {
    const delays = [
      0.3, 0.38, 6.2, 8.8, 0.46, 6.2, 0.54, 4, 0.62, 4, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5,
      7.2, 8.8, 1.6, 1.7,
    ];
    expect(popDelays(<PlanBoard />)).toEqual(delays);
    expect(popDelays(<PlanBoard portrait />)).toEqual(delays);
  });

  it('Automations', () => {
    const delays = [
      0.3, 7.8, 0.38, 3.8, 0.46, 3.8, 7.8, 0.6, 0.7, 0.8, 1.3, 4, 8, 1.5, 4.4, 8.4, 1.7, 4.8, 8.8,
      1.9, 5.3, 9.3, 5.3, 9.3, 0.9, 1, 4.4, 8.4, 4.8, 8.8,
    ];
    expect(popDelays(<AutomationsBoard />)).toEqual(delays);
    expect(popDelays(<AutomationsBoard portrait />)).toEqual(delays);
  });

  it('Together', () => {
    const delays = [
      0.3, 0.3, 5, 0.3, 5, 0.6, 0.65, 0.7, 0.75, 0.8, 6.7, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 2.9, 3.1,
      6.1,
    ];
    expect(popDelays(<TogetherBoard />)).toEqual(delays);
    expect(popDelays(<TogetherBoard portrait />)).toEqual(delays);
  });
});
