// The Real 3D scene's shared helpers (docs/specs/008-canvas/3d-engine.md): the device hints adaptive quality reads, which
// pieces stand in a wall, which walls run across the view at each turn, a group's fade and the meshes a builder makes.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createShape, type Element, type ShapeKind } from '@livehuddle/document';
import { buildModel } from '@/lib/real-3d/models';
import { pieceFrame } from '@/lib/real-3d/piece-frame';
import { pieceTones } from '@/lib/real-3d/piece-tones';
import {
  acrossFor,
  buildGroup,
  deviceHints,
  disposeFades,
  emptySceneState,
  fadeGroup,
  standsInWall,
} from './real3d-scene-kit';

afterEach(() => vi.unstubAllGlobals());

const mats = () => ({
  solid: new THREE.MeshStandardMaterial(),
  glass: new THREE.MeshStandardMaterial(),
  line: new THREE.LineBasicMaterial(),
});

const model = (kind: ShapeKind) => {
  const el = { ...createShape(kind, 0, 0), id: kind };
  return buildModel(kind, {
    f: pieceFrame(el),
    t: pieceTones(null, '#e6e9ee', '#334155'),
    seats: [],
  });
};

describe('deviceHints', () => {
  it('reads the GPU, cores, memory and a coarse pointer', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const gl = {
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 7 }),
      getParameter: (p: number) => (p === 7 ? 'Test GPU' : null),
    };
    const hints = deviceHints({ getContext: () => gl } as unknown as THREE.WebGLRenderer);
    expect(hints.gpu).toBe('Test GPU');
    expect(hints.mobile).toBe(true);
  });

  it('has no GPU without a renderer, or when reading it throws', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(deviceHints(undefined).gpu).toBeNull();
    const throwing = {
      getContext: () => {
        throw new Error('lost');
      },
    } as unknown as THREE.WebGLRenderer;
    expect(deviceHints(throwing).gpu).toBeNull();
    expect(deviceHints(undefined).mobile).toBe(false);
  });
});

describe('standsInWall', () => {
  it('holds a wall-mounted piece and a wall piece, never a standing one or a non-shape', () => {
    expect(standsInWall({ ...createShape('desk', 0, 0), id: 'd' })).toBe(false);
    expect(standsInWall({ ...createShape('door', 0, 0), id: 'w' })).toBe(true);
    expect(standsInWall({ id: 't', type: 'text' } as unknown as Element)).toBe(false);
  });
});

describe('acrossFor', () => {
  const walls = [
    { id: 'h', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
    { id: 'v', a: { x: 0, y: 0 }, b: { x: 0, y: 100 } },
  ];

  it('answers the walls across the view for a turn, the same set for turns of one parity', () => {
    const even = acrossFor(walls, 0);
    const odd = acrossFor(walls, 1);
    expect(acrossFor(walls, 2)).toBe(even);
    expect(acrossFor(walls, -1)).toBe(odd);
    expect([...even, ...odd].toSorted()).toEqual(['h', 'v']);
  });
});

describe('fadeGroup', () => {
  it('fades its own copies of the materials, shared between meshes, and back to solid', () => {
    const shared = new THREE.MeshBasicMaterial();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BufferGeometry(), shared));
    group.add(new THREE.Mesh(new THREE.BufferGeometry(), shared));
    group.add(new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()));
    group.add(new THREE.Object3D());
    fadeGroup(group, 1);
    expect(group.userData.fadeMats).toBeUndefined();
    fadeGroup(group, 0.4);
    const [a, b] = group.children as THREE.Mesh[];
    expect(a!.material).not.toBe(shared);
    expect(a!.material).toBe(b!.material);
    expect((a!.material as THREE.Material).opacity).toBe(0.4);
    expect((a!.material as THREE.Material).transparent).toBe(true);
    fadeGroup(group, 1);
    expect((a!.material as THREE.Material).transparent).toBe(false);
    expect((a!.material as THREE.Material).depthWrite).toBe(true);
    disposeFades(group);
    disposeFades(new THREE.Group());
  });
});

describe('buildGroup', () => {
  it('makes a solid mesh, a glass mesh and the outlines a model holds', () => {
    const built = buildGroup(model('floor-lamp'), mats());
    expect(built.group.children.length).toBeGreaterThanOrEqual(2);
    const solid = built.group.children[0] as THREE.Mesh;
    expect(solid.castShadow).toBe(true);
    expect(solid.geometry.getAttribute('normal').count).toBe(
      solid.geometry.getAttribute('position').count,
    );
    expect(built.group.children.some((o) => o.renderOrder === 2)).toBe(true);
    built.dispose();
  });

  it('makes nothing for an empty builder', () => {
    const empty = { positions: [], glassPositions: [], lines: [] } as never;
    expect(buildGroup(empty, mats()).group.children).toHaveLength(0);
  });
});

describe('emptySceneState', () => {
  it('starts with nothing in it, and a lift that gives back a no-op', () => {
    const s = emptySceneState();
    expect(s.walls.size + s.roofs.size + s.byId.size + s.pads.length).toBe(0);
    expect(() => s.lift('x')()).not.toThrow();
    expect(() => s.doors.update([], 0, 16)).not.toThrow();
  });
});
