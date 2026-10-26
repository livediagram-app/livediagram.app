import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TeamAvatar } from './Avatars';

// The join landing's team tile (liveworkspace/docs/specs/010-site/site.md "Joining and declining").
describe('TeamAvatar', () => {
  it('draws a team as its initials in a tile', () => {
    const html = renderToStaticMarkup(<TeamAvatar id="t" name="Northwind design" />);
    expect(html).toContain('>ND<');
    expect(html).toContain('aria-hidden="true"');
  });
});
