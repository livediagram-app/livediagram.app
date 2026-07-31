import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LASER_CONFIG,
  laserColour,
  laserLifetimeMs,
  laserStrokeWidth,
  LASER_COLOURS,
  LASER_EFFECTS,
  LASER_TRAILS,
  LASER_WIDTHS,
  parseLaserConfig,
} from './laser-config';

describe('the default pen', () => {
  it('is the laser as it always was: medium beam, your colour, one second', () => {
    // Someone who never opens the panel must see no change at all.
    expect(DEFAULT_LASER_CONFIG).toEqual({
      width: 'medium',
      colour: 'presence',
      trail: 'normal',
      effect: 'beam',
    });
    expect(laserStrokeWidth(DEFAULT_LASER_CONFIG)).toBe(3.5);
    expect(laserLifetimeMs(DEFAULT_LASER_CONFIG)).toBe(1000);
  });
});

describe('laserColour', () => {
  it('resolves "your colour" to the participant’s own', () => {
    expect(laserColour({ ...DEFAULT_LASER_CONFIG, colour: 'presence' }, '#123456')).toBe('#123456');
  });

  it('uses the swatch when one is picked', () => {
    const red = LASER_COLOURS.find((c) => c.id === 'red')!.hex;
    expect(laserColour({ ...DEFAULT_LASER_CONFIG, colour: 'red' }, '#123456')).toBe(red);
  });

  it('falls back to the participant colour for an unknown swatch', () => {
    // Belt and braces: parse already guards this, but a trail must never end
    // up with `undefined` as its stroke.
    const config = { ...DEFAULT_LASER_CONFIG, colour: 'chartreuse' as never };
    expect(laserColour(config, '#123456')).toBe('#123456');
  });
});

describe('the catalogues', () => {
  it('offer every token the derived values know about', () => {
    // A width or trail in the panel with no number behind it would render as
    // NaN; this pins the two lists together.
    for (const width of LASER_WIDTHS) {
      expect(laserStrokeWidth({ ...DEFAULT_LASER_CONFIG, width: width.id })).toBeGreaterThan(0);
    }
    for (const trail of LASER_TRAILS) {
      expect(laserLifetimeMs({ ...DEFAULT_LASER_CONFIG, trail: trail.id })).toBeGreaterThan(0);
    }
  });

  it('gives every effect a hint, since the name alone does not explain it', () => {
    for (const effect of LASER_EFFECTS) expect(effect.hint.length).toBeGreaterThan(0);
  });

  it('keeps widths and trails in increasing order, as the panel presents them', () => {
    const widths = LASER_WIDTHS.map((w) =>
      laserStrokeWidth({ ...DEFAULT_LASER_CONFIG, width: w.id }),
    );
    const trails = LASER_TRAILS.map((t) =>
      laserLifetimeMs({ ...DEFAULT_LASER_CONFIG, trail: t.id }),
    );
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
    expect([...trails].sort((a, b) => a - b)).toEqual(trails);
  });
});

describe('parseLaserConfig', () => {
  it('takes a whole valid pen', () => {
    const pen = { width: 'bold', colour: 'violet', trail: 'long', effect: 'comet' } as const;
    expect(parseLaserConfig(pen)).toEqual(pen);
  });

  it('parses the JSON form storage keeps', () => {
    expect(parseLaserConfig(JSON.stringify({ ...DEFAULT_LASER_CONFIG, width: 'fine' }))).toEqual({
      ...DEFAULT_LASER_CONFIG,
      width: 'fine',
    });
  });

  it('costs one FIELD, not the whole pen, when a token is unknown', () => {
    // A token from a newer client (or a hand-edited key) must not reset
    // everything else the user chose.
    expect(
      parseLaserConfig({ width: 'enormous', colour: 'red', trail: 'long', effect: 'beam' }),
    ).toEqual({ width: 'medium', colour: 'red', trail: 'long', effect: 'beam' });
  });

  it('falls back completely for junk', () => {
    expect(parseLaserConfig(null)).toEqual(DEFAULT_LASER_CONFIG);
    expect(parseLaserConfig('not json')).toEqual(DEFAULT_LASER_CONFIG);
    expect(parseLaserConfig(42)).toEqual(DEFAULT_LASER_CONFIG);
  });
});
