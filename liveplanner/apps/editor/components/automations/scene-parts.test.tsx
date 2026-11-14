// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Motion": a card a template scene moves into the next column lands crisp and
// whole over that column, and what it gains on the way stays inside it.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TemplateScene } from './TemplateScene';
import { NEXT_COLUMN, PREV_COLUMN } from './scene-parts';

afterEach(cleanup);

// Every template whose scene moves a card from one column into the next.
const MOVING = ['stamp-finish', 'review-on-open', 'done-on-merge', 'route-reviews'] as const;

describe('template scenes that move a card', () => {
  it('step one card slot: the paddings and the gap, no border', () => {
    expect(NEXT_COLUMN).toBe('translateX(calc(100% + 20px))');
    expect(PREV_COLUMN).toBe('translateX(calc(-100% - 20px))');
  });

  it.each(MOVING)('%s raises the column it sends from, over the next one', (id) => {
    const { container } = render(<TemplateScene id={id} tone="emerald" />);
    const drag = container.querySelector('.ats-drag')!;
    const from = drag.parentElement!;
    // The column (a stacking context, for its blur) is raised whenever it holds the moving card.
    expect(from.className).toContain('backdrop-blur-[1px]');
    expect(from.className).toContain('has-[.ats-drag]:z-10');
  });

  it.each(['stamp-finish', 'done-on-merge'] as const)(
    '%s keeps its Today pill inside the card it lands with',
    (id) => {
      const { container } = render(<TemplateScene id={id} tone="emerald" />);
      const pill = [...container.querySelectorAll('.ats-drag span')].find(
        (s) => s.textContent === 'Today',
      )!;
      expect(pill.className).toContain('right-1');
      expect(pill.className).not.toMatch(/(^|\s)-right-/);
    },
  );
});
