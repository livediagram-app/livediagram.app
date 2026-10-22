// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  projectLoadOrigin,
  noteProjectLoadEnded,
  resetTimingForTests,
  sampleSaveTiming,
  setTimingTrack,
  startEditorTiming,
} from './timing';

// The editor's timing plumbing (docs/specs/017-telemetry/timing-telemetry.md).

const navigationTo = (url: string) =>
  vi
    .spyOn(performance, 'getEntriesByType')
    .mockImplementation((type) =>
      type === 'navigation' ? ([{ name: url }] as unknown as PerformanceEntryList) : [],
    );

beforeEach(() => {
  resetTimingForTests();
  window.history.replaceState(null, '', '/project/abc');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('startEditorTiming', () => {
  it('reports through the track registered when it ends', () => {
    const timing = startEditorTiming('Save');
    const track = vi.fn();
    setTimingTrack(track);
    timing.end();
    expect(track).toHaveBeenCalledWith('Timing', 'Measured', expect.stringMatching(/^Save\./));
  });

  it('sends nothing before a track is registered', () => {
    expect(() => startEditorTiming('Save').end()).not.toThrow();
  });
});

describe('projectLoadOrigin', () => {
  it('is the navigation start when the page opened on this project', () => {
    navigationTo(`${window.location.origin}/project/abc?s=x`);
    expect(projectLoadOrigin()).toBe(0);
  });

  it('is now for an in-app arrival', () => {
    navigationTo(`${window.location.origin}/explorer`);
    expect(projectLoadOrigin()).toBeUndefined();
  });

  it("is now once the page's first load has ended, even back on the same address", () => {
    navigationTo(`${window.location.origin}/project/abc`);
    noteProjectLoadEnded();
    expect(projectLoadOrigin()).toBeUndefined();
  });

  it('is now where there is no navigation timing', () => {
    vi.spyOn(performance, 'getEntriesByType').mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(projectLoadOrigin()).toBeUndefined();
  });
});

describe('sampleSaveTiming', () => {
  it('lets the first save through, then holds the rest of the minute', () => {
    expect(sampleSaveTiming()).toBe(true);
    expect(sampleSaveTiming()).toBe(false);
  });
});
