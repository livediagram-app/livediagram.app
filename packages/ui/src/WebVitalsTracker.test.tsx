// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { siteTrack } from '@livediagram/telemetry-client';

// The lazy Web Vitals mount (docs/specs/017-telemetry/timing-telemetry.md): the reporter is its own
// chunk, loaded without server rendering, and the public sites hand it the shared siteTrack.

const { dynamicCalls, reporterProps } = vi.hoisted(() => ({
  dynamicCalls: [] as { ssr?: boolean }[],
  reporterProps: [] as { track: unknown }[],
}));
vi.mock('next/dynamic', () => ({
  default: (_load: unknown, opts: { ssr?: boolean }) => {
    dynamicCalls.push(opts);
    return (props: { track: unknown }) => {
      reporterProps.push(props);
      return null;
    };
  },
}));

import { WebVitalsBoot, WebVitalsTracker } from './WebVitalsTracker';

describe('WebVitalsTracker', () => {
  it('loads the reporter lazily, client side only', () => {
    expect(dynamicCalls).toEqual([{ ssr: false }]);
  });

  it('hands the reporter the track it is given', () => {
    const track = vi.fn();
    render(<WebVitalsTracker track={track} />);
    expect(reporterProps.at(-1)!.track).toBe(track);
  });

  it('wires the public sites to the shared siteTrack', () => {
    render(<WebVitalsBoot />);
    expect(reporterProps.at(-1)!.track).toBe(siteTrack);
  });
});
