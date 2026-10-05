import { beforeEach, describe, expect, it, vi } from 'vitest';

const siteTrack = vi.fn();
vi.mock('@livediagram/telemetry-client', () => ({
  siteTrack: (...a: unknown[]) => siteTrack(...a),
}));

import { TELEMETRY_ACTIONS, TELEMETRY_CATEGORIES } from '@livediagram/api-schema';
import { communityTelemetry } from './telemetry';

// docs/specs/025-community/community.md "Telemetry": every Community app event, on the closed enums, with a preset
// type and never post content.
beforeEach(() => siteTrack.mockReset());

describe('communityTelemetry', () => {
  it('sends each event as Community·<Action>·<preset type>', () => {
    communityTelemetry.openedPost();
    communityTelemetry.likedPost();
    communityTelemetry.unlikedPost();
    communityTelemetry.copiedPost();
    communityTelemetry.reported('Spam');
    communityTelemetry.searched();
    for (const what of ['Category', 'Tag', 'Sort', 'Mine'] as const)
      communityTelemetry.selected(what);
    expect(siteTrack.mock.calls).toEqual([
      ['Community', 'Opened', 'Post'],
      ['Community', 'Liked', 'Post'],
      ['Community', 'Unliked', 'Post'],
      ['Community', 'Copied', 'Post'],
      ['Community', 'Reported', 'Spam'],
      ['Community', 'Searched', 'Query'],
      ['Community', 'Selected', 'Category'],
      ['Community', 'Selected', 'Tag'],
      ['Community', 'Selected', 'Sort'],
      ['Community', 'Selected', 'Mine'],
    ]);
    for (const [category, action] of siteTrack.mock.calls) {
      expect(TELEMETRY_CATEGORIES).toContain(category);
      expect(TELEMETRY_ACTIONS).toContain(action);
    }
  });
});
