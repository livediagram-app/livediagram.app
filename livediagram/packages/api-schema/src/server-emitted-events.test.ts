import { describe, expect, it } from 'vitest';
import { isServerEmittedEvent, SERVER_EMITTED_EVENT_PAIRS } from './server-emitted-events';
import { TELEMETRY_ACTIONS, TELEMETRY_CATEGORIES } from './telemetry-schema';

describe('server-emitted telemetry pairs (docs/specs/017-telemetry/telemetry.md)', () => {
  it('matches the pairs the api worker owns, by category and action', () => {
    expect(isServerEmittedEvent({ category: 'Session', action: 'SignedUp' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Session', action: 'SignedIn' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Document', action: 'Joined' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Document', action: 'Used' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Email', action: 'Sent' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Team', action: 'Joined' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Token', action: 'Removed' })).toBe(true);
  });

  it('leaves the client-owned neighbours alone', () => {
    // SignedOut / Deleted still come from the browser, and so do Team·Created and Team·Added
    // (a team made in an app, an item moved into a team).
    expect(isServerEmittedEvent({ category: 'Session', action: 'SignedOut' })).toBe(false);
    expect(isServerEmittedEvent({ category: 'Session', action: 'Deleted' })).toBe(false);
    expect(isServerEmittedEvent({ category: 'Team', action: 'Created' })).toBe(false);
    expect(isServerEmittedEvent({ category: 'Team', action: 'Added' })).toBe(false);
  });

  it('only names pairs from the closed vocabulary', () => {
    for (const pair of SERVER_EMITTED_EVENT_PAIRS) {
      const [category, action] = pair.split('·');
      expect(TELEMETRY_CATEGORIES).toContain(category);
      expect(TELEMETRY_ACTIONS).toContain(action);
    }
  });
});
