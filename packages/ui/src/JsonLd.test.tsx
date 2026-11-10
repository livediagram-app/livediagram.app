import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonLd } from './JsonLd';

// The JSON-LD block, given its payload through jsonScript (livediagram/docs/specs/016-platform/trusted-types.md
// "One path for markup"): the same script it wrote when it escaped the payload itself.
describe('JsonLd', () => {
  it('writes the payload as an inline script with every < escaped', () => {
    const data = { '@type': 'Article', name: 'A </script><b>title</b>' };
    expect(renderToStaticMarkup(<JsonLd data={data} />)).toBe(
      `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
    );
  });
});
