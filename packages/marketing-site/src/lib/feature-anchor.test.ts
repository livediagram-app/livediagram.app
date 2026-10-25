import { describe, expect, it } from 'vitest';
import { featureAnchor, featureHref } from './feature-anchor';

// docs/specs/019-marketing/marketing-site.md in each product. Each app's own lib/feature-anchor.test.ts holds its
// sections' anchors unique.
describe('featureAnchor', () => {
  it('kebab-cases a title, dropping punctuation', () => {
    expect(featureAnchor('Run the session: timer + voting')).toBe('run-the-session-timer-voting');
    expect(featureAnchor('Your screen, not everyone else’s')).toBe(
      'your-screen-not-everyone-else-s',
    );
  });

  it('builds the badge link', () => {
    expect(featureHref('collaboration', 'Live presence')).toBe(
      '/features/collaboration#live-presence',
    );
  });
});
