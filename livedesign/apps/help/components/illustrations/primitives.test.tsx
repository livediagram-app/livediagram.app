// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Scene } from './primitives';

// docs/specs/018-help/help-app.md "In-article illustrations": a figure is named by its caption, so its picture is
// hidden from screen readers rather than an image with no alternative.
describe('Scene', () => {
  it('draws an SVG hidden from assistive technology, never an unnamed image', () => {
    const html = renderToStaticMarkup(
      <Scene w={10} h={10}>
        <rect />
      </Scene>,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('role="img"');
  });
});
