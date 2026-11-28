// docs/specs/009-elements/screen-and-room-sign.md "The idle face": a Screen with nothing chosen shows the
// liveworkspace logo, its prism opening and turning on a calm loop (rest, open and turn, settle home), still under
// reduced motion, and never stretched on any size of Screen.
import { describe, expect, it } from 'vitest';
import {
  containUvs,
  IDLE_LOGO_CYCLE_MS,
  IDLE_LOGO_OPEN_MS,
  IDLE_LOGO_REST_MS,
  idleLogoPose,
  idleLogoResting,
  idleScreen,
  LOGO_AT_REST,
  LOGO_STILL,
} from './idle-screen-logo';

const screen = (extra: Record<string, unknown> = {}) => ({
  type: 'shape',
  shape: 'screen',
  ...extra,
});

describe('which Screens are idle', () => {
  it('is a Screen with no file and no video it can play', () => {
    expect(idleScreen(screen())).toBe(true);
    expect(idleScreen(screen({ screenUrl: 'https://example.com/not-a-video' }))).toBe(true);
    expect(idleScreen(screen({ screenUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }))).toBe(
      false,
    );
    expect(
      idleScreen(screen({ liveItem: { app: 'livediagram', itemId: 'abc' }, liveName: 'Plan' })),
    ).toBe(false);
  });

  it('is never another piece or nothing', () => {
    expect(idleScreen({ type: 'shape', shape: 'desk' })).toBe(false);
    expect(idleScreen({ type: 'text' })).toBe(false);
    expect(idleScreen(undefined)).toBe(false);
  });
});

describe('the logo loop', () => {
  it('rests, then opens and turns, then settles home on a quarter turn', () => {
    expect(idleLogoPose(0)).toEqual(LOGO_AT_REST);
    expect(idleLogoPose(IDLE_LOGO_REST_MS - 1)).toEqual(LOGO_AT_REST);
    const opening = idleLogoPose(IDLE_LOGO_REST_MS + 1000);
    expect(opening.open).toBeCloseTo(1, 5);
    expect(opening.turn).toBeGreaterThan(0);
    const later = idleLogoPose(IDLE_LOGO_REST_MS + 3000);
    expect(later.turn).toBeGreaterThan(opening.turn);
    const home = idleLogoPose(IDLE_LOGO_CYCLE_MS - 0.001);
    expect(home.open).toBeCloseTo(0, 3);
    expect(Math.abs(home.turn / 90 - Math.round(home.turn / 90))).toBeLessThan(0.01);
  });

  it('eases in: it starts from rest without a jolt', () => {
    const a = idleLogoPose(IDLE_LOGO_REST_MS + 16);
    // Full pace would have turned it about 1 degree by now.
    expect(a.turn).toBeLessThan(0.1);
    expect(a.open).toBeLessThan(0.1);
  });

  it('moves smoothly from its turn into its settle', () => {
    const end = IDLE_LOGO_REST_MS + IDLE_LOGO_OPEN_MS;
    const before = idleLogoPose(end - 1);
    const after = idleLogoPose(end + 1);
    expect(Math.abs(after.turn - before.turn)).toBeLessThan(1);
    expect(Math.abs(after.open - before.open)).toBeLessThan(0.02);
  });

  it('repeats, and only rests in its rest beat', () => {
    expect(idleLogoPose(IDLE_LOGO_CYCLE_MS * 3 + 4000)).toEqual(idleLogoPose(4000));
    expect(idleLogoResting(IDLE_LOGO_CYCLE_MS + 100)).toBe(true);
    expect(idleLogoResting(IDLE_LOGO_REST_MS + 100)).toBe(false);
  });

  it('holds still and open under reduced motion', () => {
    for (const t of [0, 4000, 8000]) expect(idleLogoPose(t, true)).toEqual(LOGO_STILL);
    expect(idleLogoResting(4000, true)).toBe(true);
  });
});

describe('fitting the logo to a Screen', () => {
  it('shows the whole texture, never stretched', () => {
    expect(Array.from(containUvs(16 / 9, 16 / 9))).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
    // A wider place shows margin either side (u beyond 0..1, the edge colour clamped).
    const wide = containUvs(16 / 9, 32 / 9);
    expect(wide[0]).toBeCloseTo(-0.5);
    expect(wide[2]).toBeCloseTo(1.5);
    expect(wide[1]).toBe(0);
    // A taller place, above and below.
    const tall = containUvs(16 / 9, 16 / 18);
    expect(tall[1]).toBeCloseTo(-0.5);
    expect(tall[5]).toBeCloseTo(1.5);
  });
});
