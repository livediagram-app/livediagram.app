import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ANIMATION_SET_VALUES, type AnimationSetId } from '@livediagram/document';
import { AnimationSetTiles } from './AnimationSetTiles';

const noop = () => {};
const render = (set: AnimationSetId, current: string | null) =>
  renderToStaticMarkup(
    <AnimationSetTiles
      set={set}
      current={current}
      speed="slow"
      repeat
      onSet={noop}
      onSetSpeed={noop}
      onSetRepeat={noop}
    />,
  );
const tiles = (html: string) => (html.match(/<button/g) ?? []).length;

describe('AnimationSetTiles', () => {
  it('shows None plus every option of the set', () => {
    for (const set of Object.keys(ANIMATION_SET_VALUES) as AnimationSetId[]) {
      expect(tiles(render(set, null))).toBe(ANIMATION_SET_VALUES[set].length + 1);
    }
  });

  it('labels tiles by their spec name', () => {
    expect(render('media', null)).toContain('Ken Burns');
    expect(render('text', null)).toContain('Typewriter');
  });

  it('adds one kept tile for an old value the set no longer offers', () => {
    const html = render('sticky', 'bounce');
    expect(html).toContain('Bounce');
    // The tiles plus the four Speed buttons and the Repeat toggle, since a value is picked.
    expect(tiles(html)).toBe(ANIMATION_SET_VALUES.sticky.length + 2 + 5);
  });

  it('adds no kept tile for a value the set offers', () => {
    expect(tiles(render('sticky', 'pulse'))).toBe(ANIMATION_SET_VALUES.sticky.length + 1 + 5);
  });
});
