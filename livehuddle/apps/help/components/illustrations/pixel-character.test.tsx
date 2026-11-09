import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PixelCharacter } from './pixel-character';

// The pixel character keeps its own colours in dark mode (Work Tracker #492): dark mode turns the help art's slate
// ramp over, which drew its trousers, shoes and eyes light. The figure is drawn as drawn, as the canvas draws it
// (help-site's help-art.test.ts checks `help-art-as-drawn` restores every colour dark mode retargets).
describe('PixelCharacter', () => {
  it('draws the figure as drawn in both appearances, its name chip outside that', () => {
    const markup = renderToStaticMarkup(
      <svg>
        <PixelCharacter fx={50} fy={80} name="Sam" />
      </svg>,
    );
    // The figure is the first inner group, which holds no group of its own; the chip's group follows it.
    const figure = /<g[^>]*data-pixel-character=""[^>]*>(.*?)<\/g>/.exec(markup);
    expect(figure).not.toBeNull();
    expect(figure![0]).toMatch(/^<g[^>]*class="help-art-as-drawn"/);
    // Trousers, shoes and eyes are inside it; the chip is not.
    const inside = figure![1]!;
    expect(inside.match(/class="fill-slate-600"/g)).toHaveLength(2);
    expect(inside.match(/class="fill-slate-800"/g)).toHaveLength(4);
    expect(inside.replace(/<[^>]*>/g, '')).toBe('');
    expect(markup.replace(/<[^>]*>/g, '')).toBe('Sam');
  });
});
