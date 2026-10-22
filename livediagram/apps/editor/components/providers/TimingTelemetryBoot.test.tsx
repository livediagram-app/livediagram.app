// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The timing boot (docs/specs/017-telemetry/timing-telemetry.md): registers the editor's track for
// its own timings and hands the same track to the Web Vitals reporter.

const { setTimingTrack, track, vitals } = vi.hoisted(() => ({
  setTimingTrack: vi.fn(),
  track: vi.fn(),
  vitals: vi.fn(),
}));
vi.mock('@/lib/timing', () => ({ setTimingTrack }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@livediagram/ui', () => ({
  WebVitalsTracker: (props: { track: unknown }) => {
    vitals(props.track);
    return null;
  },
}));

import { TimingTelemetryBoot } from './TimingTelemetryBoot';

describe('TimingTelemetryBoot', () => {
  it("registers the editor's track for timings and Web Vitals", () => {
    render(<TimingTelemetryBoot />);
    expect(setTimingTrack).toHaveBeenCalledWith(track);
    expect(vitals).toHaveBeenCalledWith(track);
  });
});
