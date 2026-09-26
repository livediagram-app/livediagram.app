// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRUTH_ARMED_KEY, armTruthFromUrl, truthArmed, truthArmedOn } from './photo-truth';

// Arming the label export (docs/vision/sticky-detection.md). It is a
// CALIBRATION affordance, not a feature: nobody importing a photo of their
// wall should ever meet it, so it is off until someone asks for it by hand.
describe('truthArmed', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('is off by default on the hosted site: a normal author is not labelling', () => {
    expect(truthArmedOn('livediagram.app', null)).toBe(false);
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

// WHERE labelling happens is a better signal than a flag somebody has to
// remember: the detector is calibrated on a developer's own machine, against
// photographs on that machine's disk. So localhost shows it and the hosted
// site never does — with the flag still there to overrule either way.
describe('truthArmed on localhost', () => {
  beforeEach(() => localStorage.clear());
  const at = (href: string) => {
    window.history.replaceState({}, '', href);
  };
  afterEach(() => at('/'));

  it('is on by default when the editor is served from this machine', () => {
    // jsdom serves the suite from localhost, which is the point being made.
    expect(window.location.hostname).toBe('localhost');
    expect(truthArmed()).toBe(true);
  });

  it('is off on the hosted site, whatever the host machine does', () => {
    expect(truthArmedOn('livediagram.app', null)).toBe(false);
    expect(truthArmedOn('staging.livediagram.app', null)).toBe(false);
  });

  it('is on for the loopback address and the LAN-facing dev server', () => {
    expect(truthArmedOn('127.0.0.1', null)).toBe(true);
    expect(truthArmedOn('[::1]', null)).toBe(true);
  });

  it('is on for this machine by any name it answers to on the network', () => {
    // Reached from a phone or a second laptop, a dev machine is its LAN
    // address or its bare machine name, never "localhost".
    expect(truthArmedOn('192.168.1.133', null)).toBe(true);
    expect(truthArmedOn('10.0.3.1', null)).toBe(true);
    expect(truthArmedOn('172.19.0.1', null)).toBe(true);
    expect(truthArmedOn('PCWebber', null)).toBe(true);
    expect(truthArmedOn('devbox.localhost', null)).toBe(true);
  });

  it('is off for every public address, which is where the hosted site lives', () => {
    expect(truthArmedOn('172.32.0.1', null)).toBe(false); // just outside 172.16/12
    expect(truthArmedOn('8.8.8.8', null)).toBe(false);
    expect(truthArmedOn('livediagram.example.com', null)).toBe(false);
  });

  it('lets the flag overrule the host, in both directions', () => {
    expect(truthArmedOn('livediagram.app', '1')).toBe(true);
    expect(truthArmedOn('localhost', '0')).toBe(false);
  });
});
