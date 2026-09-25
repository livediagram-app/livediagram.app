import { describe, expect, it } from 'vitest';
import { isServerEmittedEvent, SERVER_EMITTED_EVENT_PAIRS } from './server-emitted-events';
import { TELEMETRY_ACTIONS, TELEMETRY_CATEGORIES } from './telemetry-schema';

describe('server-emitted telemetry pairs (spec/22)', () => {
  it('matches the pairs the api worker owns, by category and action', () => {
    expect(isServerEmittedEvent({ category: 'Session', action: 'SignedUp' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Session', action: 'SignedIn' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Diagram', action: 'Joined' })).toBe(true);
    expect(isServerEmittedEvent({ category: 'Email', action: 'Sent' })).toBe(true);
  });

  it('leaves the client-owned neighbours alone', () => {
    // SignedOut / Deleted still come from the browser, and Team·Joined is a
    // different event from Diagram·Joined.
    expect(isServerEmittedEvent({ category: 'Session', action: 'SignedOut' })).toBe(false);
    expect(isServerEmittedEvent({ category: 'Session', action: 'Deleted' })).toBe(false);
    expect(isServerEmittedEvent({ category: 'Team', action: 'Joined' })).toBe(false);
  });

  it('only names pairs from the closed vocabulary', () => {
    for (const pair of SERVER_EMITTED_EVENT_PAIRS) {
      const [category, action] = pair.split('·');
      expect(TELEMETRY_CATEGORIES).toContain(category);
      expect(TELEMETRY_ACTIONS).toContain(action);
    }
  });
});
