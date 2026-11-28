// A game character's build (docs/specs/008-canvas/3d-engine.md "Characters"): Regular is drawn exactly as before, with
// no scale of its own; another build widens the model across and front to back, never up, with the head and the held
// prop scaled back so neither is stretched, and nothing creeps from frame to frame.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { avatarBuildScale } from '@livehuddle/avatar/config';
import type { GameLook } from '@/lib/real-3d/game-look';
import { GameFigure } from './game-figure';

const PACK_SCALE = 0.5;

/** A stand-in pack: a skeleton with a hip, a neck, a head and a right wrist, no meshes and no clips. */
function pack() {
  const scene = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  const neck = new THREE.Bone();
  neck.name = 'Neck';
  neck.position.set(0, 1.4, 0);
  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.set(0, 0.2, 0);
  const wrist = new THREE.Bone();
  wrist.name = 'WristR';
  wrist.position.set(-0.6, 1, 0);
  scene.add(hips);
  hips.add(neck, wrist);
  neck.add(head);
  return { scene, clips: new Map<string, THREE.AnimationClip>(), scale: PACK_SCALE };
}

const look = (build: string | undefined): GameLook => ({
  pack: 'men',
  parts: ['head:short', 'body:tee', 'legs:jeans', 'feet:trainers'],
  tints: [],
  face: { iris: '#5b3a24', lips: '#b5675f' },
  build: avatarBuildScale(build),
});

const bone = (fig: GameFigure, name: string) =>
  fig.object.getObjectByName(name) as THREE.Bone | undefined;
const model = (fig: GameFigure) => fig.object.children[0]!;
const still = { seated: false, waving: false, seatHeight: 0 };

describe('GameFigure build', () => {
  it('gives Regular an identity build: the pack scale alone, the head and the hand as they were', () => {
    for (const build of [undefined, 'regular', 'tartan']) {
      const fig = new GameFigure(pack(), look(build));
      for (let i = 0; i < 3; i++) {
        expect(model(fig).scale.toArray()).toEqual([PACK_SCALE, PACK_SCALE, PACK_SCALE]);
        expect(bone(fig, 'Head')!.scale.toArray()).toEqual([1, 1, 1]);
        const h = fig.hand.scale;
        expect(h.x).toBe(h.z);
        expect(h.y).toBe(h.z);
        fig.update(0.016, 0, still);
      }
    }
  });

  it('widens a Large figure across and front to back, never up, the same every frame', () => {
    const fig = new GameFigure(pack(), look('large'));
    for (let i = 0; i < 4; i++) {
      const s = model(fig).scale;
      expect(s.x).toBeCloseTo(PACK_SCALE * 1.22);
      expect(s.z).toBeCloseTo(PACK_SCALE * 1.22);
      expect(s.y).toBeCloseTo(PACK_SCALE);
      fig.update(0.016, i * 20, still);
    }
  });

  it('keeps the head and the held prop at their own proportions', () => {
    for (const build of ['skinny', 'large']) {
      const fig = new GameFigure(pack(), look(build));
      // A prop in the hand, as the rig puts one there: the hand is kept upright only while it holds something.
      fig.hand.add(new THREE.Object3D());
      fig.update(0.016, 0, { ...still, holding: true });
      fig.object.updateMatrixWorld(true);
      const head = bone(fig, 'Head')!.getWorldScale(new THREE.Vector3());
      expect(head.x).toBeCloseTo(head.y);
      expect(head.z).toBeCloseTo(head.y);
      const hand = fig.hand.getWorldScale(new THREE.Vector3());
      expect(hand.x).toBeCloseTo(1);
      expect(hand.y).toBeCloseTo(1);
      expect(hand.z).toBeCloseTo(1);
    }
  });
});
