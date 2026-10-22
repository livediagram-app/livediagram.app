// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESENTATION_CONFIG,
  readPresentationConfig,
  withPresentationConfig,
} from './presentation-config';

// docs/specs/012-collaboration/presentation-mode.md "Settings": the presenter settings follow the account, in the
// preferences; what this browser kept before is read until the first change.

afterEach(() => localStorage.clear());

describe('presenter settings in the preferences', () => {
  it('reads the defaults with nothing stored', () => {
    expect(readPresentationConfig({})).toEqual(DEFAULT_PRESENTATION_CONFIG);
  });

  it("carries this browser's old settings over until the first change", () => {
    localStorage.setItem(
      'livepages:v2:presentation-config',
      JSON.stringify({ ...DEFAULT_PRESENTATION_CONFIG, loop: true }),
    );
    expect(readPresentationConfig({}).loop).toBe(true);
    const next = withPresentationConfig({}, { transition: 'fade' });
    expect(next.presentation).toMatchObject({ loop: true, transition: 'fade' });
  });

  it('trusts a stored value only once parsed', () => {
    const read = readPresentationConfig({
      presentation: { transition: 'spin', speed: 'slow', loop: 'yes', autoAdvanceSeconds: 7 },
    });
    expect(read.transition).toBe(DEFAULT_PRESENTATION_CONFIG.transition);
    expect(read.speed).toBe('slow');
    expect(read.loop).toBe(DEFAULT_PRESENTATION_CONFIG.loop);
    expect(read.autoAdvanceSeconds).toBe(0);
  });
});
