// A piece's moment in Real 3D (docs/specs/009-elements/piece-moments.md, 3d-engine.md "Moments"): every kind with a
// moment plays, moves on with time, fades its bits and ends on time, putting the piece back in the pieces' geometry.
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createShape, type Element, type ShapeKind } from '@livehuddle/document';
import { MOMENT_KINDS, MOMENT_MS } from '@/lib/piece-moments';
import { MomentFx } from './moment-fx';

const piece = (kind: ShapeKind): Element => ({ ...createShape(kind, 100, 100), id: kind });

describe('MomentFx', () => {
  for (const kind of MOMENT_KINDS)
    it(`plays ${kind}'s moment through to its end and puts the piece back`, () => {
      const scene = new THREE.Scene();
      const fx = new MomentFx(scene, new THREE.MeshStandardMaterial());
      const restore = vi.fn();
      const lift = vi.fn(() => restore);
      const before = scene.children.length;
      fx.start(piece(kind), kind, 1, { x: 40, y: 60 }, lift, 0);
      expect(fx.active).toBe(true);
      const ms = MOMENT_MS[kind] ?? 1600;
      for (const t of [0.05, 0.2, 0.5, 0.85, 0.97]) fx.update(t * ms);
      expect(fx.active).toBe(true);
      fx.update(ms);
      expect(fx.active).toBe(false);
      expect(scene.children.length).toBe(before);
      // A piece lifted out for its moment is put back once it ends.
      expect(restore.mock.calls.length).toBe(lift.mock.calls.length);
    });

  it('plays from your side when it has no feet to go by, and a new start replaces the playing one', () => {
    const scene = new THREE.Scene();
    const fx = new MomentFx(scene, new THREE.MeshStandardMaterial());
    const lift = () => () => {};
    fx.start(piece('tree'), 'tree', -1, null, lift, 0);
    fx.start(piece('tree'), 'tree', 1, null, lift, 10);
    fx.update(100);
    expect(fx.active).toBe(true);
    fx.stop('tree');
    fx.stop('tree');
    expect(fx.active).toBe(false);
  });

  it('ignores a piece that is not a shape, and stops everything on dispose', () => {
    const scene = new THREE.Scene();
    const fx = new MomentFx(scene, new THREE.MeshStandardMaterial());
    fx.start({ id: 't', type: 'text' } as unknown as Element, 'tree', 1, null, () => () => {}, 0);
    expect(fx.active).toBe(false);
    fx.start(piece('fountain'), 'fountain', 1, null, () => () => {}, 0);
    fx.start(piece('campfire'), 'campfire', 1, null, () => () => {}, 0);
    fx.dispose();
    expect(fx.active).toBe(false);
    expect(scene.children).toHaveLength(0);
  });
});
