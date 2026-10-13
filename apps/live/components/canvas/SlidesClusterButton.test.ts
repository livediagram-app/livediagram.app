import { describe, expect, it } from 'vitest';
import { showsSlidesButton } from './SlidesClusterButton';

// docs/specs/007-editor/illustrate-pages.md "Slides button": shown only while at least one page is a slide.
describe('showsSlidesButton', () => {
  it('hides the button while no page is a slide', () => {
    expect(showsSlidesButton([])).toBe(false);
    expect(showsSlidesButton([{ kind: 'infographic' }, { kind: 'logo' }, {}])).toBe(false);
  });

  it('shows it once one page is a slide', () => {
    expect(showsSlidesButton([{ kind: 'infographic' }, { kind: 'slide' }])).toBe(true);
  });
});
