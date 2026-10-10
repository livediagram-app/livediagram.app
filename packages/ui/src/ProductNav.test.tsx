import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProductNav } from './ProductNav';

// docs/specs/019-marketing/marketing-site.md "Header": on a phone the apps menu opens between the
// page's 16px gutters. Anchored to its trigger (~150px in), the w-60 card ran past a 360px screen's
// right edge, cut off when open and widening the page while hidden.
describe('ProductNav', () => {
  const html = renderToStaticMarkup(<ProductNav current="home" showOnMobile />);

  it('pins the menu to the page gutters below sm, straight under the trigger', () => {
    const bridge = html.match(/<div class="(absolute left-0 top-full[^"]*)"/)?.[1] ?? '';
    expect(bridge.split(' ')).toEqual(
      expect.arrayContaining(['max-sm:fixed', 'max-sm:inset-x-4', 'max-sm:top-auto']),
    );
  });

  it('lets the card fill that width on a phone and keeps w-60 from sm', () => {
    expect(html).toMatch(/class="w-60 max-sm:w-auto /);
  });
});
