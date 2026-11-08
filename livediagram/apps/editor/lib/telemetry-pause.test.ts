import { describe, expect, it, vi } from 'vitest';

// Watch It Built's telemetry pause (docs/specs/007-editor/watch-it-built.md "Nothing is kept"): what the replay presses
// is not the person using a feature, so tracking pauses for the run, lifted only round the replay's own events.

const sent = vi.hoisted(() => vi.fn<(category: string, action: string, type: string) => void>());
vi.mock('@livediagram/telemetry-client', () => ({
  TELEMETRY_APP: 'livediagram',
  createTelemetryEmitter: () => ({ track: sent }),
}));
vi.mock('./user-preferences', () => ({
  readUserPreferences: () => ({}),
  PREFERENCES_CHANGED_EVENT: 'livediagram:preferences-changed',
  STORAGE_KEY: 'livediagram:user-preferences:v1',
}));

import { pauseTelemetry, resumeTelemetry, track, trackDuringPause } from './telemetry';

describe('pauseTelemetry', () => {
  it('drops events while paused, sends the replay its own, and sends again once resumed', () => {
    track('UI', 'Started', 'Tour');
    pauseTelemetry();
    track('UI', 'Opened', 'Palette');
    trackDuringPause(() => track('UI', 'View', 'TourStepAdd'));
    track('UI', 'Opened', 'ElementMenu');
    resumeTelemetry();
    track('UI', 'Ended', 'TourCompleted');
    expect(sent.mock.calls.map((c) => c[2])).toEqual(['Tour', 'TourStepAdd', 'TourCompleted']);
  });

  it('keeps the pause when the replay event throws', () => {
    sent.mockClear();
    pauseTelemetry();
    expect(() =>
      trackDuringPause(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    track('UI', 'Opened', 'Palette');
    resumeTelemetry();
    expect(sent).not.toHaveBeenCalled();
  });
});
