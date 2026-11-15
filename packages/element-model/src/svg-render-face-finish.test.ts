import { describe, expect, it } from 'vitest';
import { faceFinishOf, finishFaceCornerPx, finishFaceShadows } from './finish';
import { faceAttrs, isPillRect } from '@liveworkspace/model-core/face-finish';
import { createShape } from './testing/elements';
import { svgMarkerFace, svgProfessionalFace } from './svg-render-face-finish';

// docs/specs/008-canvas/finish.md "Faces".
describe('faceFinishOf', () => {
  const board = { ...createShape('mode-button', 0, 0), id: 'b' };
  const square = { ...createShape('square', 0, 0), id: 's' };

  it('names the finish of a face that draws its own parts', () => {
    expect(faceFinishOf(board, 'professional')).toBe('professional');
    expect(faceFinishOf(board, 'marker')).toBe('marker');
    expect(faceFinishOf(board, 'sketch')).toBe('sketch');
  });

  it('leaves Flexible, and a box that is only its label, as they are', () => {
    expect(faceFinishOf(board, 'flexible')).toBeUndefined();
    expect(faceFinishOf(square, 'professional')).toBeUndefined();
  });

  it("lets an element's own corner win over Professional's square corners", () => {
    expect(faceFinishOf({ ...board, borderRadius: 'sm' }, 'professional')).toBeUndefined();
    expect(faceFinishOf({ ...board, borderRadius: 'sm' }, 'marker')).toBe('marker');
  });
});

describe('face shadows and corners', () => {
  it('draws shadows only in the finishes that cast them', () => {
    expect(finishFaceShadows('flexible')).toBe(true);
    expect(finishFaceShadows('sketch')).toBe(true);
    expect(finishFaceShadows('professional')).toBe(false);
    expect(finishFaceShadows('marker')).toBe(false);
  });

  it('squares a corner under Professional only', () => {
    expect(finishFaceCornerPx(8, 'professional')).toBe(0);
    expect(finishFaceCornerPx(8, 'marker')).toBe(8);
  });
});

describe('isPillRect', () => {
  it('tells a pill or disc from a rounded rectangle', () => {
    expect(isPillRect(80, 20, 10)).toBe(true);
    expect(isPillRect(20, 20, 10)).toBe(true);
    expect(isPillRect(80, 20, 9.6)).toBe(true);
    expect(isPillRect(80, 40, 8)).toBe(false);
    expect(isPillRect(80, 40, 0)).toBe(false);
  });
});

describe('faceAttrs', () => {
  it('reads double-quoted attributes', () => {
    expect(faceAttrs(' x="1" data-finish-keep="" stroke-width="2"')).toEqual({
      x: '1',
      'data-finish-keep': '',
      'stroke-width': '2',
    });
  });
});

describe('svgProfessionalFace', () => {
  it('squares a rounded rectangle', () => {
    expect(
      svgProfessionalFace('<rect x="0" y="0" width="80" height="40" rx="8" fill="#fff"/>'),
    ).toBe('<rect x="0" y="0" width="80" height="40" fill="#fff"/>');
  });

  it('keeps a pill, a disc and a part marked to keep', () => {
    const pill = '<rect width="80" height="20" rx="10"/>';
    const kept = '<rect width="80" height="40" rx="8" data-finish-keep=""/>';
    expect(svgProfessionalFace(pill)).toBe(pill);
    expect(svgProfessionalFace(kept)).toBe(kept);
  });

  it('thins a 2 px line and leaves others', () => {
    expect(svgProfessionalFace('<circle r="9" stroke-width="2"/><path stroke-width="3"/>')).toBe(
      '<circle r="9" stroke-width="1"/><path stroke-width="3"/>',
    );
  });
});

describe('a sticker in its finish', () => {
  const sticker =
    '<rect x="8" y="12" width="84" height="84" rx="26" fill="#0f172a" opacity="0.14" data-sticker-shadow="" data-finish-keep=""/>' +
    '<rect x="8" y="8" width="84" height="84" rx="26" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>' +
    '<svg x="23" y="23" width="54" height="54" viewBox="0 0 36 36" data-finish-keep=""><path d="M0 0 L36 0 L36 36 Z" fill="#fc0"/></svg>';

  it('drops the shadow and squares the plate under Professional', () => {
    const out = svgProfessionalFace(sticker);
    expect(out).not.toContain('data-sticker-shadow');
    expect(out).not.toMatch(/rx="26"/);
  });

  it('drops the shadow and outlines the plate in marker, the emoji kept', () => {
    const out = svgMarkerFace(sticker, 's', { width: 104, height: 104 });
    expect(out).not.toContain('data-sticker-shadow');
    expect(out).toContain('data-marker-part="frame"');
    expect(out).toContain('<path d="M0 0 L36 0 L36 36 Z" fill="#fc0"/>');
  });
});

// docs/specs/008-canvas/finish.md "Tables": the export draws a Marker table as the canvas does.
describe('a table in marker', () => {
  const face = { width: 360, height: 150 };
  const rule = (attrs = '') =>
    `<line x1="0" y1="50" x2="360" y2="50" fill="none" stroke="#94a3b8" stroke-width="1"${attrs}/>`;

  it('keeps a plain hairline as it is', () => {
    expect(svgMarkerFace(rule(), 't', face)).toBe(rule());
  });

  it('draws a grid rule in one marker stroke at any width, dashed or not, in its ink', () => {
    for (const attrs of [' data-marker-rule=""', ' stroke-dasharray="6 4" data-marker-rule=""']) {
      const out = svgMarkerFace(rule(attrs), 't', face);
      expect(out).toContain('data-marker-part="line"');
      expect(out).not.toContain('<line');
      expect(out).toContain('stroke="#94a3b8"');
    }
  });

  it('draws a rule too pale to read in a stronger shade, as the canvas does', () => {
    const out = svgMarkerFace(
      '<line x1="0" y1="50" x2="360" y2="50" stroke="#f1f5f9" stroke-width="1" data-marker-rule=""/>',
      't',
      face,
    );
    expect(out).toContain('data-marker-part="line"');
    expect(out).not.toContain('stroke="#f1f5f9"');
  });

  // The canvas's face pass reads the same FaceBox.bodyDrawn (useFaceFinishPass's readParts), so the two match.
  it("leaves the outer frame to the table's hand-drawn body, never framing it again", () => {
    const frame =
      '<rect x="0" y="0" width="360" height="150" fill="none" stroke="#94a3b8" stroke-width="1"/>';
    expect(svgMarkerFace(frame, 't', face)).toContain('data-marker-part="frame"');
    const body = '<g data-finish="marker"></g>';
    expect(svgMarkerFace(body + frame, 't', face)).toBe(body + frame);
  });

  // The canvas hides the grid's own border under the body (face-finish.css), so the export drops the plain one too.
  it("drops the table's plain outer frame under its hand-drawn Marker body, and only there", () => {
    const frame =
      '<rect x="0" y="0" width="360" height="150" fill="none" stroke="#94a3b8" stroke-width="1" data-marker-body-frame=""/>';
    const body = '<g data-finish="marker"></g>';
    expect(svgMarkerFace(body + frame, 't', face)).toBe(body);
    expect(svgMarkerFace(body + frame, 't', face, 'pencil')).toBe(body + frame);
    expect(svgMarkerFace(frame, 't', face)).toContain('data-marker-part="frame"');
  });

  it("leaves a cell's colour flat", () => {
    const cell = '<rect x="0" y="0" width="120" height="50" fill="#eceef2" data-finish-keep=""/>';
    expect(svgMarkerFace(cell, 't', face)).toBe(cell);
  });
});
