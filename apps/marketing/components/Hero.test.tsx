import { describe, expect, it } from 'vitest';
import { HERO_CTAS } from './Hero';

// docs/specs/019-marketing/marketing-site.md "Hero": Draw, Diagram, Brainstorm, in that order.
describe('the hero calls to action', () => {
  it('offers Draw, Diagram and Brainstorm, Diagram the primary', () => {
    expect(HERO_CTAS.map((c) => c.label)).toEqual(['Draw', 'Diagram', 'Brainstorm']);
    expect(HERO_CTAS.filter((c) => c.primary).map((c) => c.label)).toEqual(['Diagram']);
  });

  it('sends Draw straight to a whiteboard, Diagram to the wizard, Brainstorm to its collection', () => {
    expect(HERO_CTAS.map((c) => [c.href, c.source])).toEqual([
      ['/new?template=whiteboard', 'Home.HeroDraw'],
      ['/new', 'Home.Hero'],
      ['/new?browse=brainstorm', 'Home.HeroBrainstorm'],
    ]);
  });
});
