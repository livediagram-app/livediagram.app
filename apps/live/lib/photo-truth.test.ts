// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRUTH_ARMED_KEY, armTruthFromUrl, truthArmed } from './photo-truth';

// Arming the label export (docs/vision/sticky-detection.md). It is a
// CALIBRATION affordance, not a feature: nobody importing a photo of their
// wall should ever meet it, so it is off until someone asks for it by hand.
describe('truthArmed', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('is off by default, because a normal author is not labelling anything', () => {
    expect(truthArmed()).toBe(false);
  });

  it('is on once the flag is set', () => {
    localStorage.setItem(TRUTH_ARMED_KEY, '1');
    expect(truthArmed()).toBe(true);
  });

  it('is armed by a query parameter, and STAYS armed across the navigation', () => {
    // The editor is reached from /new, so a parameter on the first URL is gone
    // by the time the review opens. Arming writes the flag and the flag lasts.
    armTruthFromUrl('https://livediagram.app/new/?truth=1');
    expect(localStorage.getItem(TRUTH_ARMED_KEY)).toBe('1');
    expect(truthArmed()).toBe(true);
  });

  it('is disarmed by the same parameter set to nothing', () => {
    localStorage.setItem(TRUTH_ARMED_KEY, '1');
    armTruthFromUrl('https://livediagram.app/new/?truth=0');
    expect(truthArmed()).toBe(false);
  });

  it('leaves the flag alone when the URL says nothing about it', () => {
    localStorage.setItem(TRUTH_ARMED_KEY, '1');
    armTruthFromUrl('https://livediagram.app/diagram/abc/');
    expect(truthArmed()).toBe(true);
  });

  it('survives a browser with no storage at all, rather than taking the page down', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(truthArmed()).toBe(false);
    expect(() => armTruthFromUrl('https://x/?truth=1')).not.toThrow();
  });
});
