import { describe, expect, it } from 'vitest';
import { layOutInfographicPages } from '@livediagram/document';
import { pagesClipPath } from './InfographicPageClip';

// Infographic mode cuts elements off at the page edges (docs/specs/007-editor/editor-modes.md
// "The pages").
describe('pagesClipPath', () => {
  it('traces every page as one closed rectangle', () => {
    const pages = layOutInfographicPages([
      { id: 'a', orientation: 'portrait' },
      { id: 'b', orientation: 'landscape' },
    ]);
    expect(pagesClipPath(pages)).toBe(
      "path('M-397 -561.5H397V561.5H-397ZM493 -397H1616V397H493Z')",
    );
  });
});
