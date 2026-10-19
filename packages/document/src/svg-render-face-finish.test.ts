import { describe, expect, it } from 'vitest';
import { faceFinishOf, finishFaceCornerPx, finishFaceShadows } from './finish';
import { faceAttrs, isPillRect } from './face-finish';
import { createShape } from './shape-factory';
import { svgBoxed } from './svg-render';
import { svgProfessionalFace } from './svg-render-face-finish';

// docs/specs/008-canvas/finish.md "Faces".
describe('faceFinishOf', () => {
  const board = { ...createShape('layer-stack', 0, 0), id: 'b' };
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
    expect(faceFinishOf({ ...board, borderRadius: 'lg' }, 'professional')).toBeUndefined();
    expect(faceFinishOf({ ...board, borderRadius: 'lg' }, 'marker')).toBe('marker');
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
    expect(svgProfessionalFace('<rect x="0" y="0" width="80" height="40" rx="8" fill="#fff"/>')).toBe(
      '<rect x="0" y="0" width="80" height="40" fill="#fff"/>',
    );
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

  it("squares a layer stack's bands in the export", () => {
    const stack = { ...createShape('layer-stack', 0, 0), id: 'ls' };
    const flexible = svgBoxed(stack, {});
    const professional = svgBoxed(stack, { tabFinish: 'professional' });
    expect(flexible).toMatch(/rx="8"/);
    expect(professional).not.toMatch(/rx="8"/);
  });
});
