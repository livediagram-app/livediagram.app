'use client';

// Real 3D's piece moments (docs/specs/009-elements/piece-moments.md, 3d-engine.md "Moments"): the small surprise a
// piece plays when you walk up to it, played in the scene. The piece itself is lifted out of the pieces' one
// geometry while it plays and moved as one (a tree rocks away from you, a plant shivers, a cabinet bumps), and the
// moment's own bits fly in the round: leaves falling, butterflies, a pebble, a coin, sparks, steam, a car's lamps, a
// glint. Each moment builds what it needs when it starts and frees it when it ends; nothing runs while none plays.
// The few shapes the bits are made of (a leaf, a ball, a ring, a coin, a wing) are made once for the page's life.

import * as THREE from 'three';
import type { Element } from '@livehuddle/document';
import { MOMENT_MS, type MomentKind } from '@/lib/piece-moments';
import { frameToCanvas, pieceFrame, type PieceBox } from '@/lib/real-3d/piece-frame';
import { piecesMesh } from '@/lib/real-3d/scene-pieces';
import { kindHeight } from '@/lib/real-3d/models/kit';

type Particle = {
  obj: THREE.Object3D;
  mat: THREE.Material & { opacity: number };
  /** Its place at time t (0..1 of the moment), and its opacity. */
  at: (t: number, o: THREE.Object3D) => number;
};

type Playing = {
  id: string;
  t0: number;
  ms: number;
  /** The lifted piece about its base, and how it moves. */
  pivot: THREE.Group | null;
  move: ((t: number, g: THREE.Group) => void) | null;
  particles: Particle[];
  restore: () => void;
  dispose: () => void;
};

const ROCK = new Set([
  'tree',
  'garden-umbrella',
  'coat-rack',
  'hammock',
  'stage-curtains',
  'umbrella-stand',
]);
const SHIVER = new Set([
  'outdoor-plant',
  'plant',
  'lockers',
  'kettle',
  'hand-dryer',
  'vending-machine',
]);

const damp = (t: number, hz: number, k = 3.2) => Math.exp(-k * t) * Math.sin(Math.PI * 2 * hz * t);

function glowMaterial(colour: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: colour,
    transparent: true,
    depthWrite: false,
    opacity: 1,
  });
}

function litMaterial(colour: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: colour,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  });
}

const LEAF_GEO = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [0, -3, 0, 2, 0, 0.4, 0, 3, 0, 0, -3, 0, 0, 3, 0, -2, 0, 0.4],
      3,
    ),
  );
  g.computeVertexNormals();
  return g;
})();
const BALL_GEO = new THREE.SphereGeometry(1, 10, 8);
const RING_GEO = new THREE.RingGeometry(0.78, 1, 48);
const COIN_GEO = new THREE.CylinderGeometry(2.2, 2.2, 0.5, 20);
const WING_GEO = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 3.4, 2.2, 0, 3, -1.8, 0], 3),
  );
  g.computeVertexNormals();
  return g;
})();

const rand = (seed: number) => {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export class MomentFx {
  private readonly playing = new Map<string, Playing>();
  private readonly scene: THREE.Scene;
  private readonly material: THREE.Material;
  constructor(scene: THREE.Scene, material: THREE.Material) {
    this.scene = scene;
    this.material = material;
  }

  /**
   * Starts a piece's moment: `el` the piece, `side` your side along it (-1, 1), `feet` where you stand, `lift` hides
   * the piece in the pieces' geometry and returns what puts it back.
   */
  start(
    el: Element,
    kind: MomentKind,
    side: number,
    feet: { x: number; y: number } | null,
    lift: () => () => void,
    now: number,
  ): void {
    if (el.type !== 'shape') return;
    this.stop(el.id);
    const box = el as unknown as PieceBox;
    const f = pieceFrame(box);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const H = kindHeight(kind);
    const ms = MOMENT_MS[kind] ?? 1600;
    // Away from you, across the canvas: from your feet to the piece's middle.
    const ax = feet ? cx - feet.x : side * -1;
    const ay = feet ? cy - feet.y : 0;
    const al = Math.hypot(ax, ay) || 1;
    const away = { x: ax / al, y: ay / al };
    const particles: Particle[] = [];
    const add = (
      obj: THREE.Object3D,
      mat: THREE.Material & { opacity: number },
      at: Particle['at'],
    ) => {
      obj.frustumCulled = false;
      this.scene.add(obj);
      particles.push({ obj, mat, at });
    };
    let move: Playing['move'] = null;
    if (ROCK.has(kind)) {
      const a = kind === 'tree' ? 0.07 : 0.1;
      // Tilt about the base, away from you: a turn about the axis across your line.
      move = (t, g) => {
        const r = a * damp(t, 1.6);
        g.rotation.set(-away.y * r, away.x * r, 0);
      };
    } else if (SHIVER.has(kind)) {
      move = (t, g) => {
        const r = 0.035 * damp(t, 7, 4.5);
        g.rotation.set(0, r, r * 0.5);
      };
    } else if (
      kind !== 'car-park' &&
      kind !== 'pond' &&
      kind !== 'swimming-pool' &&
      kind !== 'window'
    ) {
      // Everything else answers with a bump: a little hop and squash, and settles.
      move = (t, g) => {
        const k = t < 0.3 ? Math.sin((t / 0.3) * Math.PI) : 0;
        g.position.z = k * 1.6;
        g.scale.set(1 + k * 0.015, 1 + k * 0.015, 1 - k * 0.02);
      };
    }
    // The moment's own bits.
    switch (kind) {
      case 'tree':
      case 'plant': {
        const n = kind === 'tree' ? 5 : 1;
        for (let i = 0; i < n; i++) {
          const mat = litMaterial(i === 2 ? 0xe2b33c : i % 2 ? 0x428c46 : 0x63ad5c);
          const leaf = new THREE.Mesh(LEAF_GEO, mat);
          leaf.scale.setScalar(kind === 'tree' ? 2.6 : 2);
          leaf.castShadow = true;
          const r0 = (kind === 'tree' ? 56 : 14) * (0.9 + rand(i + 1) * 0.15);
          // From the side of the crown facing you, so they fall in sight.
          const a0 = Math.atan2(-away.y, -away.x) + (rand(i + 7) - 0.5) * 2.2;
          const z0 = kind === 'tree' ? 95 + rand(i + 3) * 35 : 34;
          const delay = i * 0.08;
          add(leaf, mat, (t, o) => {
            const u = Math.max(0, (t - delay) / (1 - delay));
            o.position.set(
              cx + Math.cos(a0) * r0 + away.x * u * 26 + Math.sin(u * 9 + i) * 5,
              cy + Math.sin(a0) * r0 * 0.6 + away.y * u * 26,
              Math.max(0.5, z0 * (1 - u)),
            );
            o.rotation.set(u * 7 + i, u * 5, u * 9);
            return u < 0.8 ? 1 : (1 - u) / 0.2;
          });
        }
        break;
      }
      case 'outdoor-plant': {
        for (let i = 0; i < 2; i++) {
          const mat = litMaterial(i === 0 ? 0xf472b6 : 0xfde047);
          const fly = new THREE.Group();
          const l = new THREE.Mesh(WING_GEO, mat);
          const r = new THREE.Mesh(WING_GEO, mat);
          r.scale.x = -1;
          fly.add(l, r);
          fly.scale.setScalar(i === 0 ? 2.6 : 1.9);
          const delay = i * 0.25;
          add(fly, mat, (t, o) => {
            const u = Math.max(0, (t - delay) / (1 - delay));
            const flap = Math.sin(t * 90) * 0.9;
            l.rotation.y = flap;
            r.rotation.y = -flap;
            o.position.set(
              cx + away.x * u * 70 + Math.sin(u * 12) * 8,
              cy + away.y * u * 70 + Math.cos(u * 10) * 6,
              24 + u * 70 + Math.sin(u * 20) * 4,
            );
            return u === 0 ? 0 : u < 0.75 ? 1 : (1 - u) / 0.25;
          });
        }
        break;
      }
      case 'pond':
      case 'fountain':
      case 'swimming-pool': {
        const coin = kind === 'fountain';
        const mat = coin ? litMaterial(0xe0b13e) : litMaterial(0x9ca3af);
        const thing = new THREE.Mesh(coin ? COIN_GEO : BALL_GEO, mat);
        if (!coin) thing.scale.set(3.6, 3, 2.4);
        else thing.scale.setScalar(1.6);
        const sx = feet ? feet.x : cx - away.x * 40;
        const sy = feet ? feet.y : cy - away.y * 40;
        const water = coin ? 9 : 1;
        add(thing, mat, (t, o) => {
          const u = Math.min(1, t / 0.5);
          o.position.set(
            sx + (cx - sx) * u,
            sy + (cy - sy) * u,
            14 + 60 * u * (1 - u) * 1.4 + (water - 14) * u,
          );
          o.rotation.set(u * 12, u * 4, 0);
          return u < 1 ? 1 : 0;
        });
        for (let i = 0; i < 2; i++) {
          const rm = glowMaterial(0xffffff);
          const ring = new THREE.Mesh(RING_GEO, rm);
          add(ring, rm, (t, o) => {
            const u = (t - 0.5 - i * 0.14) / 0.42;
            if (u <= 0) return 0;
            const r = 3 + u * (coin ? 22 : 30);
            o.position.set(cx, cy, water + 0.3);
            o.scale.set(r, r, 1);
            return Math.max(0, 0.95 * (1 - u));
          });
        }
        break;
      }
      case 'fireplace':
      case 'campfire': {
        const baseZ = kind === 'campfire' ? 8 : 18;
        const front = frameToCanvas(f, 0, kind === 'campfire' ? 0 : f.D / 2 - 10);
        for (let i = 0; i < 10; i++) {
          const mat = glowMaterial(i % 3 ? 0xf59e0b : 0xfde047);
          const spark = new THREE.Mesh(BALL_GEO, mat);
          spark.scale.setScalar(1.4);
          const dx = (rand(i + 11) - 0.5) * 14;
          const dy = (rand(i + 5) - 0.5) * 8;
          const delay = rand(i + 2) * 0.35;
          add(spark, mat, (t, o) => {
            const u = (t - delay) / 0.6;
            if (u <= 0 || u >= 1) return 0;
            o.position.set(front.x + dx + Math.sin(u * 8 + i) * 3, front.y + dy, baseZ + u * 46);
            return 1 - u;
          });
        }
        break;
      }
      case 'kettle':
      case 'kitchen-sink':
      case 'washbasin':
      case 'fridge':
      case 'hand-dryer': {
        // Puffs of steam or cold air: soft white balls rising and spreading.
        const top = kind === 'hand-dryer' ? 40 : H + 4;
        for (let i = 0; i < 3; i++) {
          const mat = glowMaterial(kind === 'fridge' ? 0xdbeafe : 0xffffff);
          const puff = new THREE.Mesh(BALL_GEO, mat);
          const delay = i * 0.18;
          add(puff, mat, (t, o) => {
            const u = (t - delay) / 0.55;
            if (u <= 0 || u >= 1) return 0;
            o.position.set(
              cx + Math.sin(u * 5 + i) * 3,
              cy,
              top + u * (kind === 'fridge' ? -10 : 22),
            );
            o.scale.setScalar(1.5 + u * 4);
            return 0.6 * (1 - u);
          });
        }
        break;
      }
      case 'car-park': {
        // The car nearest you flashes its lamps twice.
        const cars = [
          frameToCanvas(f, f.foot.x0 + (f.foot.x1 - f.foot.x0) * (44 / 240), 0),
          frameToCanvas(f, f.foot.x0 + (f.foot.x1 - f.foot.x0) * (196 / 240), 0),
        ];
        const near = feet
          ? cars.reduce((a, b) =>
              Math.hypot(a.x - feet.x, a.y - feet.y) < Math.hypot(b.x - feet.x, b.y - feet.y)
                ? a
                : b,
            )
          : cars[0]!;
        const carX =
          near === cars[0]
            ? f.foot.x0 + (f.foot.x1 - f.foot.x0) * (44 / 240)
            : f.foot.x0 + (f.foot.x1 - f.foot.x0) * (196 / 240);
        const w = Math.min(
          (f.foot.x1 - f.foot.x0) * (60 / 240),
          (f.foot.y1 - f.foot.y0) * 0.66 * 0.56,
        );
        const noseY = f.foot.y0 + (f.foot.y1 - f.foot.y0) * (118 / 128);
        for (const s of [-1, 1]) {
          const p = frameToCanvas(f, carX + s * (w / 2 - 7), noseY);
          const mat = glowMaterial(0xfff7cc);
          const lamp = new THREE.Mesh(BALL_GEO, mat);
          add(lamp, mat, (t, o) => {
            o.position.set(p.x, p.y, 9);
            const on = (t > 0.05 && t < 0.22) || (t > 0.34 && t < 0.51);
            o.scale.setScalar(on ? 5 : 0.01);
            return on ? 0.85 : 0;
          });
        }
        break;
      }
      default: {
        // A glint: a few small stars over the piece's top on your side.
        for (let i = 0; i < 3; i++) {
          const mat = glowMaterial(0xffffff);
          const star = new THREE.Mesh(BALL_GEO, mat);
          const dx = (rand(i + 21) - 0.5) * box.width * 0.6 - away.x * 8;
          const dy = (rand(i + 23) - 0.5) * box.height * 0.4 - away.y * 8;
          const delay = i * 0.12;
          add(star, mat, (t, o) => {
            const u = (t - delay) / 0.35;
            if (u <= 0 || u >= 1) return 0;
            o.position.set(cx + dx, cy + dy, H + 6 + u * 6);
            o.scale.setScalar(2.4 * Math.sin(u * Math.PI));
            return Math.sin(u * Math.PI);
          });
        }
        break;
      }
    }
    // Lift the piece out to move it as one, about its base's middle.
    let pivot: THREE.Group | null = null;
    let restore = () => {};
    const geos: THREE.BufferGeometry[] = [];
    if (move) {
      const b = piecesMesh([el]);
      if (b.positions.length) {
        pivot = new THREE.Group();
        pivot.position.set(cx, cy, 0);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(b.colours, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
        g.translate(-cx, -cy, 0);
        geos.push(g);
        const mesh = new THREE.Mesh(g, this.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        pivot.add(mesh);
        this.scene.add(pivot);
        restore = lift();
      } else move = null;
    }
    this.playing.set(el.id, {
      id: el.id,
      t0: now,
      ms,
      pivot,
      move,
      particles,
      restore,
      dispose: () => {
        for (const p of particles) {
          this.scene.remove(p.obj);
          p.mat.dispose();
        }
        if (pivot) this.scene.remove(pivot);
        geos.forEach((g) => g.dispose());
      },
    });
  }

  /** Moves every playing moment on to `now`, ending those done. */
  update(now: number): void {
    for (const p of this.playing.values()) {
      const t = (now - p.t0) / p.ms;
      if (t >= 1) {
        this.stop(p.id);
        continue;
      }
      if (p.pivot && p.move) p.move(t, p.pivot);
      for (const q of p.particles) {
        const o = q.at(t, q.obj);
        q.mat.opacity = o;
        q.obj.visible = o > 0.01;
      }
    }
  }

  get active(): boolean {
    return this.playing.size > 0;
  }

  stop(id: string): void {
    const p = this.playing.get(id);
    if (!p) return;
    this.playing.delete(id);
    p.restore();
    p.dispose();
  }

  dispose(): void {
    for (const id of [...this.playing.keys()]) this.stop(id);
  }
}
