// Real 3D's grounding and marks (docs/specs/008-canvas/3d-engine.md "The camera", "Selection", "Screens light while
// someone sits"): a contact shadow under each standing piece and none under a flat or hung one, a desk's screen lit
// only while a sitter's feet are at it, and a selection's box outline rebuilt only when the set changes.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createShape, type Element, type ShapeKind } from '@livehuddle/document';
import { piecesMesh } from '@/lib/real-3d/scene-pieces';
import { contactShadows } from './contact-shadows';
import { deskScreens } from './desk-screens';
import { SelectionMarks } from './selection-marks';

const piece = (shape: ShapeKind, x: number, y: number, extra: Partial<Element> = {}): Element =>
  ({ ...createShape(shape, x, y), id: shape, ...extra }) as Element;

const board: Element[] = [
  piece('desk', 0, 0),
  piece('bean-bag', 400, 0),
  piece('tree', 800, 0),
  piece('coat-rack', 1200, 0),
  piece('rug', 0, 600),
  piece('road', 600, 600),
];
const mesh = piecesMesh(board);
const kindOf = (id: string) => {
  const el = board.find((e) => e.id === id);
  return el?.type === 'shape' ? el.shape : undefined;
};

describe('contactShadows', () => {
  it('casts one shadow a standing piece, none under a flat rug or a road', () => {
    const shadows = contactShadows(mesh.bounds, () => false, kindOf);
    const inst = shadows.object as THREE.InstancedMesh;
    const ids = mesh.bounds.map((b) => b.id);
    expect(ids).toContain('road');
    expect(inst.count).toBeGreaterThanOrEqual(3);
    expect(inst.count).toBeLessThan(mesh.bounds.length);
    const half = inst.geometry.getAttribute('halfSize');
    expect(half.count).toBeGreaterThanOrEqual(inst.count);
    shadows.dispose();
  });

  it('lays a shadow over a lawn at the blades, and hides and shows one piece', () => {
    const shadows = contactShadows(mesh.bounds, () => true, kindOf);
    const inst = shadows.object as THREE.InstancedMesh;
    const at = new THREE.Matrix4();
    inst.getMatrixAt(0, at);
    const p = new THREE.Vector3().setFromMatrixPosition(at);
    expect(p.z).toBeGreaterThan(1);
    const show = shadows.hide('desk');
    inst.getMatrixAt(0, at);
    expect(new THREE.Vector3().setFromMatrixScale(at).x).toBe(0);
    show();
    inst.getMatrixAt(0, at);
    expect(new THREE.Vector3().setFromMatrixScale(at).x).toBeCloseTo(1);
    // A piece with no shadow has nothing to hide.
    expect(() => shadows.hide('nobody')()).not.toThrow();
    shadows.dispose();
  });

  it('builds with no pieces at all', () => {
    const shadows = contactShadows([], () => false, kindOf);
    expect((shadows.object as THREE.InstancedMesh).count).toBe(0);
    shadows.dispose();
  });
});

describe('deskScreens', () => {
  const desk = mesh.bounds.find((b) => b.id === 'desk')!;
  // One screen of the desk: its first triangle of the pieces' corners.
  const from = mesh.ranges.get('desk')!.from;
  const screens = new Map([
    ['desk', [from, from + 3]],
    ['gone', [0, 3]],
  ]);

  it('lights the desk a sitter is at, dims it when they leave, and ignores one far away', () => {
    const lit = deskScreens(screens, mesh.positions, mesh.bounds);
    const obj = lit.object as THREE.Mesh;
    expect(obj.visible).toBe(false);
    lit.update([{ x: desk.f.cx, y: desk.f.cy }]);
    expect(obj.visible).toBe(true);
    expect(obj.geometry.getAttribute('position').count).toBe(3);
    // The same sitters again change nothing.
    lit.update([{ x: desk.f.cx + 1, y: desk.f.cy }]);
    expect(obj.visible).toBe(true);
    lit.update([{ x: desk.f.cx + 5000, y: desk.f.cy }]);
    expect(obj.visible).toBe(false);
    lit.dispose();
  });

  it('has nothing to light without screens', () => {
    const lit = deskScreens(new Map(), mesh.positions, mesh.bounds);
    lit.update([{ x: desk.f.cx, y: desk.f.cy }]);
    expect((lit.object as THREE.Mesh).visible).toBe(false);
    lit.dispose();
  });
});

describe('SelectionMarks', () => {
  it('outlines each selected piece as a box and rebuilds only when the set changes', () => {
    const marks = new SelectionMarks();
    marks.set(mesh.bounds.slice(0, 2));
    expect(marks.group.children).toHaveLength(1);
    const lines = marks.group.children[0] as THREE.LineSegments;
    // Twelve edges a box, two corners an edge.
    expect(lines.geometry.getAttribute('position').count).toBe(2 * 24);
    marks.set(mesh.bounds.slice(0, 2));
    expect(marks.group.children[0]).toBe(lines);
    marks.set([]);
    expect(marks.group.children).toHaveLength(0);
    marks.dispose();
  });
});
