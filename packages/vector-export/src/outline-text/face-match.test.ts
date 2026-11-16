// livedesign/docs/specs/007-editor/logo-pages.md "Outlined text": the face CSS font matching picks, and the synthesis the
// browser adds when a face lacks the bold or italic asked of it.
import { describe, expect, it } from 'vitest';
import { matchFace } from './face-match';
import type { FaceSource } from './font-face-css';

const face = (
  weight: [number, number],
  style: FaceSource['style'] = 'normal',
  ranges: [number, number][] = [[0, 0xff]],
  family = 'Brand',
): FaceSource => ({
  family,
  weight,
  style,
  ranges,
  url: `${family}-${weight.join('-')}-${style}-${ranges[0]![0]}`,
});

const A = 0x41;
const pick = (faces: FaceSource[], w: number, italic = false) =>
  matchFace(faces, 'brand', w, italic, A)?.face.weight[0];

describe('matchFace', () => {
  it('needs a face of the family (any case) that covers the letter', () => {
    const faces = [face([400, 400]), face([400, 400], 'normal', [[0x100, 0x17f]], 'Brand')];
    expect(matchFace(faces, 'BRAND', 400, false, A)?.face).toBe(faces[0]);
    expect(matchFace(faces, 'Brand', 400, false, 0x4e00)).toBeNull();
    expect(matchFace(faces, 'Other', 400, false, A)).toBeNull();
  });

  it('takes the weight inside a range, clamped to it, and a variable face draws at the asked weight', () => {
    const m = matchFace([face([100, 900])], 'Brand', 650, false, A)!;
    expect(m).toMatchObject({ weight: 650, syntheticBold: false, syntheticItalic: false });
  });

  it('matches weights as CSS does: 400 to 500 up to 500 then down then up', () => {
    const faces = [face([300, 300]), face([500, 500]), face([700, 700])];
    expect(pick(faces, 400)).toBe(500);
    expect(pick([face([300, 300]), face([700, 700])], 450)).toBe(300);
    expect(pick([face([700, 700])], 400)).toBe(700);
  });

  it('under 400 looks down then up; over 500 up then down', () => {
    expect(pick([face([200, 200]), face([400, 400])], 300)).toBe(200);
    expect(pick([face([400, 400])], 300)).toBe(400);
    expect(pick([face([400, 400]), face([800, 800])], 600)).toBe(800);
    expect(pick([face([400, 400])], 700)).toBe(400);
  });

  it('synthesises a bold at 600 and up from a lighter face, never under 600', () => {
    expect(matchFace([face([400, 400])], 'Brand', 700, false, A)).toMatchObject({
      weight: 400,
      syntheticBold: true,
    });
    expect(matchFace([face([400, 400])], 'Brand', 500, false, A)?.syntheticBold).toBe(false);
    expect(matchFace([face([400, 700])], 'Brand', 700, false, A)?.syntheticBold).toBe(false);
  });

  it('prefers italic, then oblique, then a slanted upright for italic; the reverse for upright', () => {
    const upright = face([400, 400]);
    const oblique = face([400, 400], 'oblique');
    const italic = face([400, 400], 'italic');
    expect(matchFace([upright, oblique, italic], 'Brand', 400, true, A)?.face).toBe(italic);
    expect(matchFace([upright, oblique], 'Brand', 400, true, A)?.face).toBe(oblique);
    expect(matchFace([upright], 'Brand', 400, true, A)?.syntheticItalic).toBe(true);
    expect(matchFace([italic, upright], 'Brand', 400, false, A)?.face).toBe(upright);
    expect(matchFace([italic], 'Brand', 400, false, A)?.syntheticItalic).toBe(false);
  });
});
