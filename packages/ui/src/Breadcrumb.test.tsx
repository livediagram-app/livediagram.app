import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BreadcrumbTrail } from './Breadcrumb';

// docs/specs/004-interface-design/touch-targets.md (in each product): a link that `truncate` clips keeps its
// 44px tap area by padding, never by a ::before pad.
describe('BreadcrumbTrail touch targets', () => {
  it('pads breadcrumb links by padding, which `truncate` cannot clip', () => {
    const html = renderToStaticMarkup(
      <BreadcrumbTrail
        rootLabel="Home"
        items={[{ label: 'Features', href: '/features' }, { label: 'Plan' }]}
      />,
    );
    const links = [...html.matchAll(/<a [^>]*class="([^"]*)"[^>]*>/g)].map((m) => m[1]!);
    expect(links).toHaveLength(2);
    for (const c of links) {
      expect(c).toMatch(/\bpointer-coarse:py-3\b/);
      expect(c).toMatch(/\bpointer-coarse:-my-3\b/);
    }
  });
});
