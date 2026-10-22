// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  documentLoadOrigin,
  noteDocumentLoadEnded,
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
  window.history.replaceState(null, '', '/document/abc');
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

describe('documentLoadOrigin', () => {
  it('is the navigation start when the page opened on this document', () => {
    navigationTo(`${window.location.origin}/document/abc?s=x`);
    expect(documentLoadOrigin()).toBe(0);
  });

  it('is now for an in-app arrival', () => {
    navigationTo(`${window.location.origin}/explorer`);
    expect(documentLoadOrigin()).toBeUndefined();
  });

  it("is now once the page's first load has ended, even back on the same address", () => {
    navigationTo(`${window.location.origin}/document/abc`);
    noteDocumentLoadEnded();
    expect(documentLoadOrigin()).toBeUndefined();
  });

  it('is now where there is no navigation timing', () => {
    vi.spyOn(performance, 'getEntriesByType').mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(documentLoadOrigin()).toBeUndefined();
  });
});

describe('sampleSaveTiming', () => {
  it('lets the first save through, then holds the rest of the minute', () => {
    expect(sampleSaveTiming()).toBe(true);
    expect(sampleSaveTiming()).toBe(false);
  });
});
