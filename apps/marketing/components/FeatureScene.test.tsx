import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FeatureScene } from './FeatureScene';

// docs/specs/019-marketing/marketing-site.md "Feature scenes": the static HTML holds the window and
// its canvas but not the scene, which is first drawn when it starts to play, so it never flashes
// its finished frame before the build; the veil rests clear.
describe('FeatureScene', () => {
  it('renders the window and its aspect-ratio canvas without the scene', () => {
    const markup = renderToStaticMarkup(<FeatureScene scene="plan" />);
    expect(markup).toContain('Launch');
    expect(markup).toContain('aspect-[16/10]');
    expect(markup).not.toContain('Launch board');
  });

  it('rests with a clear veil, never the stage veil that flashes grey', () => {
    const markup = renderToStaticMarkup(<FeatureScene scene="plan" />);
    expect(markup).toContain('opacity-0');
    expect(markup).not.toMatch(/hero-fade(-out)?\b/);
  });
});
