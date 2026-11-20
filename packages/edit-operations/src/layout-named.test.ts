import { describe, expect, it } from 'vitest';
import { layoutNamed } from './layout-named';

const ids = (...list: string[]) => list.map((id) => ({ id }));
const SLIDES = ids(
  'slide-title',
  'slide-title-image',
  'agenda',
  'slide-agenda-grid',
  'quote',
  'slide-bullets',
  'key-stats',
);

describe('layoutNamed', () => {
  it('reads an id as itself, in any case and with spaces or underscores for hyphens', () => {
    expect(layoutNamed(SLIDES, 'agenda')).toEqual({ layout: { id: 'agenda' } });
    expect(layoutNamed(SLIDES, ' Slide Title ')).toEqual({ layout: { id: 'slide-title' } });
    expect(layoutNamed(SLIDES, 'key_stats')).toEqual({ layout: { id: 'key-stats' } });
  });

  it('reads a plain name as the one layout it can mean', () => {
    expect(layoutNamed(SLIDES, 'title')).toEqual({ layout: { id: 'slide-title' } });
    expect(layoutNamed(SLIDES, 'bullets')).toEqual({ layout: { id: 'slide-bullets' } });
    expect(layoutNamed(ids('wf-settings', 'wf-sign-in'), 'sign in')).toEqual({
      layout: { id: 'wf-sign-in' },
    });
  });

  it('names the closest for a name two layouts share or none has, the ids holding it first', () => {
    expect(layoutNamed(ids('wf-card', 'logo-card', 'wf-cart'), 'card')).toEqual({
      layout: null,
      closest: ['wf-card', 'logo-card', 'wf-cart'],
    });
    expect(layoutNamed(SLIDES, 'bulets')).toEqual({ layout: null, closest: ['slide-bullets'] });
    expect(layoutNamed(SLIDES, 'ag')).toEqual({ layout: null, closest: [] });
    expect(layoutNamed(SLIDES, 'swot-analysis')).toEqual({ layout: null, closest: [] });
  });
});
