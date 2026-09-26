import { describe, expect, it } from 'vitest';
import { metadata } from './layout';

// The editor paints its own dark chrome (docs/specs/007-editor/live-app.md, Appearance). Dark
// Reader recolouring it on top double-darkens the canvas art and rewrites inline
// SVG attributes before React hydrates, which surfaces as a hydration mismatch.
// Its documented opt-out is a `<meta name="darkreader-lock">` in the head.
describe('dark reader lock', () => {
  it('declares the darkreader-lock meta on every editor route', () => {
    // Non-empty on purpose: Next's metadata renderer drops a meta whose content
    // is empty, so an empty value passes here and never reaches the page.
    expect(metadata.other?.['darkreader-lock']).toMatch(/\S/);
  });
});
