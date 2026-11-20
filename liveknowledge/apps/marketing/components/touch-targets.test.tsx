import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LANDING_SECTIONS } from '@/lib/landing-content';
import { StoryBeat } from './StoryBeat';

// docs/specs/019-marketing/marketing-site.md "Feature sections": a beat's art is its picture at every width.
describe('story beats', () => {
  it.each(LANDING_SECTIONS.map((s, i) => [s.id, s, i] as const))(
    '%s shows its art on a phone too, and labels its region',
    (_id, section, index) => {
      const html = renderToStaticMarkup(<StoryBeat section={section} index={index} />);
      expect(html).toContain(`id="${section.id}"`);
      expect(html).toContain(`aria-labelledby="${section.id}-title"`);
      // The art's column is never hidden below the two-column breakpoint.
      expect(html).not.toMatch(/class="hidden lg:block/);
      expect(html).toContain('[content-visibility:auto]');
      for (const point of section.points) expect(html).toContain(point);
    },
  );

  it('alternates the art’s side and the tinted ground', () => {
    const sides = LANDING_SECTIONS.map((section, index) =>
      renderToStaticMarkup(<StoryBeat section={section} index={index} />).includes('lg:order-2'),
    );
    expect(sides).toEqual(LANDING_SECTIONS.map((_, i) => i % 2 === 1));
  });
});
