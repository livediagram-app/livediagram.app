import { describe, expect, it } from 'vitest';
import { GAME_CAMERA, gameCameraView } from './game-camera';

// docs/specs/009-elements/social-pieces.md "On a small screen" (Work Item 620).

const table = { x: 100, y: 200, width: 184, height: 112 };
const phone = { width: 390, height: 700 };
const fit = { zoom: 0.5, offset: { x: 0, y: 0 } };

describe('gameCameraView', () => {
  it('brings a table shown 92 px wide on a phone to 60% of the canvas, centred', () => {
    const to = gameCameraView(table, phone, fit)!;
    expect(to.zoom).toBeCloseTo((390 * 0.6) / 184);
    // The table's centre sits at the canvas's centre.
    expect(to.offset).toEqual({ x: 195 - 192, y: 350 - 256 });
  });

  it('does the same in a 450 px window', () => {
    expect(gameCameraView(table, { width: 450, height: 800 }, fit)!.zoom).toBeCloseTo(
      (450 * 0.6) / 184,
    );
  });

  it('keeps a table on its side within half the canvas height', () => {
    const turned = { ...table, width: 112, height: 184 };
    expect(gameCameraView(turned, { width: 600, height: 300 }, fit)!.zoom).toBeCloseTo(
      (300 * 0.5) / 184,
    );
  });

  it('never goes closer than the cap', () => {
    const small = { ...table, width: 40, height: 24 };
    expect(gameCameraView(small, phone, fit)!.zoom).toBe(GAME_CAMERA.maxZoom);
  });

  it('leaves a wide canvas alone', () => {
    expect(gameCameraView(table, { width: 640, height: 900 }, fit)).toBeNull();
  });

  it('leaves a table that already reads alone (160 px or more on screen)', () => {
    expect(gameCameraView(table, phone, { zoom: 160 / 184, offset: { x: 0, y: 0 } })).toBeNull();
    expect(gameCameraView(table, phone, { zoom: 1, offset: { x: 0, y: 0 } })).toBeNull();
  });

  it('never zooms out', () => {
    // A short canvas whose height share would pick a zoom below the current one.
    expect(gameCameraView(table, { width: 390, height: 100 }, fit)).toBeNull();
  });

  it('ignores an empty canvas or box', () => {
    expect(gameCameraView(table, { width: 0, height: 0 }, fit)).toBeNull();
    expect(gameCameraView({ ...table, width: 0 }, phone, fit)).toBeNull();
  });
});
