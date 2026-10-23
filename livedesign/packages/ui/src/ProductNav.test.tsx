import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProductNavLinks } from './ProductNav';

// docs/specs/013-workspace/explorer-structure.md "Layout": the editor's Explorer footer carries the same surfaces as
// links, the current one and Telemetry left out.
describe('ProductNavLinks', () => {
  const html = renderToStaticMarkup(<ProductNavLinks current="editor" />);

  it('lists every other surface but Telemetry as a link, in order', () => {
    const labels = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>.*?<\/span>([^<]+)<\/a>/g)].map(
      (m) => m[2],
    );
    expect(labels).toEqual(['Home', 'Explorer', 'Help']);
    expect(html).toContain('aria-label="Go to"');
    expect(html).not.toContain('>Editor<');
  });

  it('is 44 px tall on a touch screen', () => {
    expect(html).toContain('pointer-coarse:h-11');
  });
});
