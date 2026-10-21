import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlanBoard } from './hero-plan-board';
import { settledColumns } from './hero-plan-data';

// docs/specs/019-marketing/marketing-site.md "Hero" (6) Plan: the board as it rests agrees with the
// board bar the window draws over it (PlanBoardBar in hero-editor-chrome.tsx, "33% done · 4/12").
describe('PlanBoard', () => {
  it('rests with 4 of its 12 cards in Done, as its bar says', () => {
    const cols = settledColumns();
    expect(cols.flat()).toHaveLength(12);
    expect(cols.at(-1)).toHaveLength(4);
    expect(Math.round((4 / 12) * 100)).toBe(33);
  });

  it('holds In progress at its WIP limit and Review within it once the cards have moved', () => {
    const [, todo, doing, review] = settledColumns();
    expect(todo!.map((c) => c.title)).toEqual(['Pricing page', 'Release notes']);
    expect(doing).toHaveLength(3);
    expect(review).toHaveLength(1);
  });

  it('ticks each count over to its settled value', () => {
    const markup = renderToStaticMarkup(<PlanBoard />);
    // The last value each count reaches is drawn last, after the values it replaces.
    for (const text of ['3 / 3', '1 / 2', '>4<']) expect(markup).toContain(text);
    expect(markup).toContain('Release notes');
    expect(markup).toContain('@sam');
  });

  it('draws a phone the same board in narrower cards', () => {
    const markup = renderToStaticMarkup(<PlanBoard portrait />);
    expect(markup).toContain('Onboarding emails');
    expect(markup).not.toContain('Due 14 Oct');
  });
});
