import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LANDING_SECTIONS } from './landing-content';

// Every feature card's art renders to a finished, decorative picture in the static export
// (docs/specs/019-marketing/marketing-site.md "Story beats"): hidden from assistive tech, with no
// coordinate or label left NaN or undefined.
describe('feature card art', () => {
  for (const section of LANDING_SECTIONS) {
    for (const item of section.items) {
      it(`${section.id}: ${item.title}`, () => {
        const html = renderToStaticMarkup(<>{item.art}</>);
        expect(html).toMatch(/^<[a-z]+ [^>]*aria-hidden="true"/);
        expect(html).not.toMatch(/NaN|undefined/);
      });
    }
  }
});
