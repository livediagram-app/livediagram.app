import {
  configureWorkbench,
  resetWorkbenchForTests,
  type WorkbenchTrack,
} from '@liveworkspace/workbench/bindings';
import { testBindings } from '@liveworkspace/workbench/lib/testing/bindings';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { limitOfRefusal, walkthroughTelemetry } from './telemetry';

const track = vi.fn<WorkbenchTrack>();

beforeEach(() => {
  track.mockClear();
  configureWorkbench(testBindings({ track }));
});
afterEach(() => resetWorkbenchForTests());

describe('walkthrough telemetry', () => {
  it('names a limit by the api refusal that is one, and nothing else', () => {
    expect(limitOfRefusal('too_long')).toBe('TooLong');
    expect(limitOfRefusal('file_too_large')).toBe('TooLarge');
    expect(limitOfRefusal('item_full')).toBe('ItemFull');
    expect(limitOfRefusal('walkthroughs_full')).toBe('AccountFull');
    expect(limitOfRefusal('forbidden')).toBeNull();
    expect(limitOfRefusal('constructor')).toBeNull();
    expect(limitOfRefusal(undefined)).toBeNull();
  });

  it('sends each event under the Walkthrough category, with a type only for a limit', () => {
    walkthroughTelemetry.recordingStarted();
    walkthroughTelemetry.saved();
    walkthroughTelemetry.abandoned();
    walkthroughTelemetry.refused('TooLong');
    walkthroughTelemetry.played();
    walkthroughTelemetry.deleted();
    expect(track.mock.calls).toEqual([
      ['Walkthrough', 'Started', undefined],
      ['Walkthrough', 'Created', undefined],
      ['Walkthrough', 'Abandoned', undefined],
      ['Walkthrough', 'Refused', 'TooLong'],
      ['Walkthrough', 'Played', undefined],
      ['Walkthrough', 'Deleted', undefined],
    ]);
  });
});
