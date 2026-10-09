import { describe, expect, it } from 'vitest';
import { layOutIllustratePages, newLogoPage } from '@livediagram/document';
import { onLogoPage } from './LayerSelectionChrome';

// docs/specs/007-editor/logo-pages.md "A logo page": no quick-connect pluses on a logo page.
describe('onLogoPage', () => {
  const pages = layOutIllustratePages([newLogoPage('l'), { id: 'i', orientation: 'portrait' }]);
  const box = (x: number, y: number) => ({ x, y, width: 40, height: 40 });

  it('is true for a selection centred on a logo page, false elsewhere or off Illustrate', () => {
    const logo = pages[0]!.rect;
    const other = pages[1]!.rect;
    expect(onLogoPage(pages, box(logo.x + 100, logo.y + 100))).toBe(true);
    expect(onLogoPage(pages, box(other.x + 100, other.y + 100))).toBe(false);
    expect(onLogoPage(null, box(logo.x + 100, logo.y + 100))).toBe(false);
  });
});
