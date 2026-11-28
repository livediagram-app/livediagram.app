'use client';

// Real 3D's office dog (docs/specs/008-canvas/3d-engine.md "The office dog"): each Pet Bed's dog as a model in the
// scene. Where it is and what it does stay the dog's own drawing's (components/canvas/collab/OfficeDog.tsx, hidden in
// the 3D view): each frame the model reads the drawing's place (mid-trot included) and marks, as the characters are
// read from their walkers, and poses itself (lib/real-3d/dog-pose.ts): curled asleep in its bed, trotting on the
// floor, lying down to rest. A press on the model pats it through the drawing's own Pat the Dog button.

import * as THREE from 'three';
import { pieceFrame, type PieceBox } from '@/lib/real-3d/piece-frame';
import { FigureMotion, headingOf, turnToward } from '@/lib/real-3d/figure-motion';
import { RISE } from '@/lib/real-3d/models/kit';
import { real3DScreenAt } from '@/lib/real-3d/real-3d-pick';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import {
  boxHit,
  breath,
  dogLimbs,
  easeToward,
  heartAt,
  readDog,
  stepPhase,
  wagHz,
} from '@/lib/real-3d/dog-pose';
import { ownNormals, EYE } from './scene-look';

/** How big the model stands against the drawing it was built to (a characters' knee to hip high). */
const DOG_SCALE = 1.35;
/** The cushion's top in its Pet Bed, where it sleeps (models/outdoor.ts 'pet-bed': 3.5 built, risen). */
const BED_TOP = 3.5 * RISE;
/** Under the pointer it glows (3d-view.md "Pieces you can use"). */
const GLOW = 0x38bdf8;
/** Where the camera's eye is this frame (scene-look.ts EYE), as a point. */
const EYE_AT = new THREE.Vector3();

const TONE = {
  coat: 0xd9a66b,
  deep: 0x8a5a2b,
  cream: 0xf6e2c2,
  nose: 0x1f2937,
  blush: 0xf2a39b,
  collar: 0xef4444,
  tag: 0xf5c542,
  white: 0xffffff,
  heart: 0xf43f5e,
  z: 0xe2e8f0,
} as const;

/** Presses on the editor's own controls are left alone (as useScenePresses). */
const CONTROLS =
  'button, input, textarea, select, a, [role="toolbar"], [role="menu"], [role="dialog"], [data-selection-grips] *';

// The shapes every dog is made of, made once for the page's life.
const SPHERE = new THREE.SphereGeometry(1, 20, 14);
const LEG = new THREE.CapsuleGeometry(1.9, 4.4, 4, 10);
const TAIL = new THREE.CapsuleGeometry(1.25, 5.2, 4, 10);
const COLLAR = new THREE.TorusGeometry(4.2, 0.95, 8, 24);
const SHADOW = new THREE.CircleGeometry(1, 20);
const HEART = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -3.2);
  s.bezierCurveTo(-1.2, -2, -4, -0.6, -4, 1.4);
  s.bezierCurveTo(-4, 3.4, -1.4, 4, 0, 2.2);
  s.bezierCurveTo(1.4, 4, 4, 3.4, 4, 1.4);
  s.bezierCurveTo(4, -0.6, 1.2, -2, 0, -3.2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 1.2,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.5,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.center();
  return g;
})();
const ZED = (() => {
  // A "z" as a rounded strip: top bar, the slant, the bottom bar.
  const s = new THREE.Shape();
  s.moveTo(-2, 2);
  s.lineTo(2, 2);
  s.lineTo(2, 1.1);
  s.lineTo(-0.6, -1.1);
  s.lineTo(2, -1.1);
  s.lineTo(2, -2);
  s.lineTo(-2, -2);
  s.lineTo(-2, -1.1);
  s.lineTo(0.6, 1.1);
  s.lineTo(-2, 1.1);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.6,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.2,
    bevelSegments: 2,
  });
  g.center();
  return g;
})();

type Part = THREE.Mesh;

type Dog = {
  root: THREE.Group;
  body: THREE.Group;
  chest: Part;
  belly: Part;
  legs: { pivot: THREE.Group; front: boolean; pair: 'a' | 'b'; x: number }[];
  neck: THREE.Group;
  eyes: Part[];
  tailWag: THREE.Group;
  tailLift: THREE.Group;
  shadow: THREE.Mesh;
  heart: THREE.Mesh;
  zed: THREE.Mesh;
  mats: THREE.MeshLambertMaterial[];
  /** Its coat's materials, which glow under the pointer (not the heart's or the z's). */
  coatMats: THREE.MeshLambertMaterial[];
  motion: FigureMotion | null;
  yaw: number;
  phase: number;
  lie: number;
  home: number;
  heartAt: number;
  heartNode: Element | null;
  hover: boolean;
  /** Where it stands and how high its top is, for a press on it. */
  at: { x: number; y: number; z: number; top: number };
};

function material(colour: number, mats: THREE.MeshLambertMaterial[]): THREE.MeshLambertMaterial {
  const m = ownNormals(new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide }));
  mats.push(m);
  return m;
}

function part(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  at: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
): Part {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.scale.set(...scale);
  m.castShadow = true;
  m.frustumCulled = false;
  return m;
}

/**
 * One dog's model, facing +y (its front), feet on z 0, in canvas px: a round sandy body over four stubby legs, a big
 * head with floppy darker ears, a patch over one eye, a cream snout and chest, dark eyes and nose, a red collar with a
 * gold tag, and a tail with a cream tip.
 */
function dogModel(): Dog {
  const mats: THREE.MeshLambertMaterial[] = [];
  const coat = material(TONE.coat, mats);
  const deep = material(TONE.deep, mats);
  const cream = material(TONE.cream, mats);
  const nose = material(TONE.nose, mats);
  const blush = material(TONE.blush, mats);
  const collar = material(TONE.collar, mats);
  const tag = material(TONE.tag, mats);
  const white = material(TONE.white, mats);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // The body: a round barrel, its cream chest and belly under it.
  body.add(part(SPHERE, coat, [0, -0.5, 0], [6.2, 9.6, 6]));
  const chest = part(SPHERE, cream, [0, 5.4, -0.9], [4.5, 4.4, 4.6]);
  const belly = part(SPHERE, cream, [0, -0.5, -2.6], [4.6, 7.2, 3.4]);
  body.add(chest, belly);

  // Four stubby legs, each a pivot at its hip, with a cream paw.
  const legs: Dog['legs'] = [];
  for (const [x, y, front, pair] of [
    [-3.5, 5, true, 'a'],
    [3.5, 5, true, 'b'],
    [-3.5, -5.6, false, 'b'],
    [3.5, -5.6, false, 'a'],
  ] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 9);
    const leg = part(LEG, coat, [0, 0, -4.4]);
    leg.rotation.x = Math.PI / 2;
    const paw = part(SPHERE, cream, [0, 0.7, -8.4], [2.2, 2.7, 1.3]);
    pivot.add(leg, paw);
    root.add(pivot);
    legs.push({ pivot, front, pair, x });
  }

  // The head on its neck: a big round head, cream snout, nose, eyes with a glint, floppy ears, a patch, blush.
  const neck = new THREE.Group();
  const head = new THREE.Group();
  head.position.set(0, 2.6, 5);
  neck.add(head);
  head.add(part(SPHERE, coat, [0, 0, 0], [6.4, 6.0, 5.9]));
  head.add(part(SPHERE, deep, [2.6, 2.4, 2.2], [3.0, 3.3, 3.2]));
  head.add(part(SPHERE, cream, [0, 5.4, -1.8], [3.4, 3.0, 2.6]));
  head.add(part(SPHERE, nose, [0, 8.2, -0.9], [1.45, 1.05, 1.05]));
  const eyes: Part[] = [];
  for (const x of [-2.5, 2.5]) {
    const eye = part(SPHERE, nose, [x, 5.1, 1.5], [0.95, 0.7, 1.05]);
    const glint = part(SPHERE, white, [0.35, 0.6, 0.35], [0.3, 0.3, 0.3]);
    glint.scale.divide(eye.scale);
    eye.add(glint);
    eyes.push(eye);
    head.add(eye);
    head.add(part(SPHERE, blush, [x * 1.55, 4.0, -1.6], [1.15, 0.6, 0.8]));
  }
  for (const side of [-1, 1]) {
    const ear = part(SPHERE, deep, [side * 5.6, -0.6, 0.2], [1.5, 2.8, 4.4]);
    ear.rotation.y = side * 0.38;
    ear.rotation.x = -0.15;
    head.add(ear);
  }
  // The collar round the neck, its tag at the front.
  const ring = part(COLLAR, collar, [0, 0.6, 0.6]);
  ring.rotation.x = -0.55;
  neck.add(ring, part(SPHERE, tag, [0, 4.4, -1.6], [1.0, 0.6, 1.0]));
  root.add(neck);

  // The tail: wags side to side about its root, held up behind (or down along the floor lying), a cream tip.
  const tailWag = new THREE.Group();
  tailWag.position.set(0, -9.2, 13);
  const tailLift = new THREE.Group();
  tailWag.add(tailLift);
  const tail = part(TAIL, coat, [0, 0, 3.8]);
  tail.rotation.x = Math.PI / 2;
  tailLift.add(tail, part(SPHERE, cream, [0, 0, 7.4], [1.45, 1.45, 1.6]));
  root.add(tailWag);

  // A soft shadow under it on the floor.
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(SHADOW, shadowMat);
  shadow.renderOrder = 1;
  shadow.frustumCulled = false;
  root.add(shadow);

  const coatMats = [...mats];
  // A pat's heart and a sleeper's "z", over its head.
  const heart = part(HEART, material(TONE.heart, mats), [0, 0, 0]);
  heart.castShadow = false;
  heart.visible = false;
  const zed = part(ZED, material(TONE.z, mats), [0, 0, 0]);
  zed.castShadow = false;
  zed.visible = false;
  // Upright as they turn to the eye: z is up in the scene.
  heart.up.set(0, 0, 1);
  zed.up.set(0, 0, 1);
  root.add(heart, zed);

  root.scale.setScalar(DOG_SCALE);
  return {
    root,
    body,
    chest,
    belly,
    legs,
    neck,
    eyes,
    tailWag,
    tailLift,
    shadow,
    heart,
    zed,
    mats: [...mats],
    coatMats,
    motion: null,
    yaw: 0,
    phase: 0,
    lie: 1,
    home: 1,
    heartAt: -Infinity,
    heartNode: null,
    hover: false,
    at: { x: 0, y: 0, z: 0, top: 0 },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Every Pet Bed's dog in the scene, read from the dogs' drawings under `main` each frame. */
export class OfficeDogs {
  private readonly dogs = new Map<HTMLElement, Dog>();
  private readonly scene: THREE.Scene;
  private readonly main: HTMLElement;
  /** The dog a press began on, so its release pats it and none of it walks, selects or drags. */
  private pressed: HTMLElement | null = null;
  private swallowUntil = 0;
  private patting = false;
  private cursorSet = false;
  private readonly off: (() => void)[] = [];

  constructor(scene: THREE.Scene, main: HTMLElement) {
    this.scene = scene;
    this.main = main;
    const win = main.ownerDocument.defaultView ?? window;
    const listen = (type: string, fn: (e: Event) => void, passive = false) => {
      win.addEventListener(type, fn, { capture: true, passive });
      this.off.push(() => win.removeEventListener(type, fn, { capture: true }));
    };
    const stop = (e: Event) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.cancelable) e.preventDefault();
    };
    listen('pointerdown', (e) => {
      const p = e as PointerEvent;
      if (p.button !== 0 || !this.ours(p)) return;
      const node = this.dogAt(p.clientX, p.clientY);
      if (!node) return;
      this.pressed = node;
      stop(e);
    });
    listen('pointerup', (e) => {
      if (!this.pressed) return;
      const p = e as PointerEvent;
      const node = this.pressed;
      this.pressed = null;
      this.swallowUntil = performance.now() + 600;
      stop(e);
      if (this.dogAt(p.clientX, p.clientY) === node) this.pat(node);
    });
    listen('pointercancel', () => {
      this.pressed = null;
    });
    for (const type of ['mousedown', 'mouseup', 'click', 'dblclick'])
      listen(type, (e) => {
        if (this.patting) return;
        if (this.pressed || performance.now() < this.swallowUntil) stop(e);
      });
    listen(
      'pointermove',
      (e) => {
        const p = e as PointerEvent;
        const node = this.ours(p) ? this.dogAt(p.clientX, p.clientY) : null;
        for (const [n, dog] of this.dogs) this.glow(dog, n === node);
        this.cursor(node !== null);
      },
      true,
    );
  }

  /** Whether a press is on the canvas itself (not on a control over it). */
  private ours(e: PointerEvent): boolean {
    const t = e.target instanceof Element ? e.target : null;
    return !!t && this.main.contains(t) && !t.closest(CONTROLS);
  }

  /** The dog (its drawing) a screen point is on, the nearest to the camera first; null when none. */
  private dogAt(x: number, y: number): HTMLElement | null {
    for (const [node, dog] of this.dogs) {
      if (!dog.root.visible) continue;
      const r = 12 * DOG_SCALE;
      const pts: { x: number; y: number }[] = [];
      for (const dx of [-r, r])
        for (const dy of [-r, r])
          for (const z of [dog.at.z, dog.at.z + dog.at.top]) {
            const p = real3DScreenAt(dog.at.x + dx, dog.at.y + dy, z);
            if (p) pts.push(p);
          }
      if (boxHit(pts, x, y, 2)) return node;
    }
    return null;
  }

  private pat(node: HTMLElement): void {
    const button = node.querySelector<HTMLButtonElement>('button[aria-label="Pat the Dog"]');
    if (!button) return;
    this.patting = true;
    try {
      button.click();
    } finally {
      this.patting = false;
    }
  }

  private glow(dog: Dog, on: boolean): void {
    if (dog.hover === on) return;
    dog.hover = on;
    for (const m of dog.coatMats) {
      m.emissive.setHex(on ? GLOW : 0x000000);
      m.emissiveIntensity = on ? 0.2 : 0;
    }
  }

  private cursor(on: boolean): void {
    if (on === this.cursorSet) return;
    this.cursorSet = on;
    this.main.style.cursor = on ? 'pointer' : '';
  }

  /** Poses every dog for this frame: `bedOf` finds a bed on the board by its id. */
  update(now: number, dt: number, bedOf: (id: string) => PieceBox | undefined): void {
    const nodes = this.main.querySelectorAll<HTMLElement>('[data-pet]');
    // Read once a frame, and only while there is a dog to still.
    const still = nodes.length > 0 && prefersReducedMotion();
    const t = now / 1000;
    const seen = new Set<HTMLElement>();
    for (const node of nodes) {
      const id = node.closest('[data-element-id]')?.getAttribute('data-element-id');
      const bed = id ? bedOf(id) : undefined;
      if (!bed) continue;
      seen.add(node);
      const m = new DOMMatrix(getComputedStyle(node).transform);
      const read = readDog(bed, m.m41, m.m42, {
        pet: node.getAttribute('data-pet'),
        floor: node.parentElement?.hasAttribute('data-pet-floor') ?? false,
        trot: node.hasAttribute('data-pet-trot'),
        left: node.hasAttribute('data-pet-left'),
      });
      let dog = this.dogs.get(node);
      const fresh = !dog;
      if (!dog) {
        dog = dogModel();
        this.scene.add(dog.root);
        this.dogs.set(node, dog);
      }
      this.pose(dog, node, read, bed, now, t, dt, still, fresh);
    }
    for (const [node, dog] of this.dogs)
      if (!seen.has(node)) {
        this.scene.remove(dog.root);
        this.free(dog);
        this.dogs.delete(node);
      }
  }

  private pose(
    dog: Dog,
    node: HTMLElement,
    read: ReturnType<typeof readDog>,
    bed: PieceBox,
    now: number,
    t: number,
    dt: number,
    still: boolean,
    fresh: boolean,
  ): void {
    const facing = read.left ? 'left' : 'right';
    if (!dog.motion) dog.motion = new FigureMotion(facing);
    dog.motion.update(read.feet, dt, facing, false);
    // Lying down and settling into its bed take a moment; a dog just drawn is already as it is.
    const lieWant = read.asleep && !read.trotting ? 1 : 0;
    const homeWant = read.home ? 1 : 0;
    dog.lie = fresh ? lieWant : easeToward(dog.lie, lieWant, dt);
    dog.home = fresh ? homeWant : easeToward(dog.home, homeWant, dt);
    const lie = smooth(dog.lie);
    const home = smooth(dog.home);
    // In its bed it lies along the bed's length, on the cushion, in the bed's middle.
    const f = pieceFrame(bed);
    const bedYaw = headingOf(Math.cos(f.yaw), Math.sin(f.yaw));
    const want = read.home ? bedYaw : dog.motion.yaw;
    dog.yaw = fresh ? want : turnToward(dog.yaw, want, dt, 1);
    const x = lerp(read.feet.x, f.cx, home);
    const y = lerp(read.feet.y, f.cy, home);
    const z = BED_TOP * home;
    dog.root.position.set(x, y, z);
    dog.root.rotation.z = dog.yaw;
    dog.at = { x, y, z, top: lerp(27, 15, lie) * DOG_SCALE };

    // Its step, from how fast it really moves.
    const speed = still ? 0 : dog.motion.speed;
    const stride = Math.min(1, speed / 40);
    dog.phase = stepPhase(dog.phase, speed, dt);
    const heart = node.querySelector('[data-pet-heart]');
    if (heart && heart !== dog.heartNode) dog.heartAt = now;
    dog.heartNode = heart;
    const patted = heart !== null;
    const limbs = dogLimbs(dog.phase, stride, lie, t, still ? 0 : wagHz(patted, stride, lie));
    const puff = still ? 0 : breath(t, lie);

    // The body sinks to the floor as it lies down, bobbing once a step as it trots, swelling with each breath.
    dog.body.position.set(0, 0, lerp(11, 5.4, lie) + limbs.bob);
    dog.body.scale.set(1 + 0.04 * puff, 1 + 0.03 * lie, lerp(1, 0.78, lie) * (1 + 0.05 * puff));
    for (const leg of dog.legs) {
      // Lying, the front paws reach forward under its chin and the back legs fold forward along its sides.
      const tuck = leg.front ? 1.4 : 1.15;
      leg.pivot.position.set(
        leg.x * (1 + 0.25 * lie),
        leg.pivot.position.y,
        lerp(9, 3.6, lie) + limbs.bob,
      );
      leg.pivot.rotation.x = lerp(leg.pair === 'a' ? limbs.a : limbs.b, tuck, lie);
    }
    // The head rides on the body; lying, it rests on its paws, turned a little to one side.
    dog.neck.position.set(0, lerp(8, 8.6, lie), lerp(15, 1.6, lie) + limbs.bob * 0.8);
    dog.neck.rotation.set(
      lerp(Math.sin(dog.phase * 2) * 0.04 * stride, 0.12, lie),
      0,
      lerp(patted ? Math.sin(t * 9) * 0.12 : 0, 0.32, lie),
    );
    // Eyes shut while it lies resting.
    for (const eye of dog.eyes) eye.scale.z = lerp(1.05, 0.18, lie);
    // The tail: up and wagging, or curled round along the floor.
    dog.tailWag.position.z = lerp(13, 6.2, lie) + limbs.bob;
    dog.tailWag.rotation.z = limbs.wag + 0.95 * lie;
    dog.tailLift.rotation.x = lerp(0.5, 1.7, lie);
    // Its shadow: under it on the floor, none in its bed (the bed's own).
    const r = lerp(9, 11, lie) * (1 - home);
    dog.shadow.visible = r > 0.5;
    dog.shadow.scale.set(r * 0.75, r, 1);
    dog.shadow.position.set(0, 0, 0.4 / DOG_SCALE);

    // Facing the eye, as a card would: the heart and the "z" turn to look at the camera, upright.
    const w = EYE.value.w;
    const eye =
      w === 0
        ? EYE_AT.set(x + EYE.value.x * 1e4, y + EYE.value.y * 1e4, z + EYE.value.z * 1e4)
        : EYE_AT.set(EYE.value.x / w, EYE.value.y / w, EYE.value.z / w);
    dog.root.updateMatrixWorld();
    // The pat's heart rises over its head and fades.
    const h = heartAt(now - dog.heartAt, still);
    dog.heart.visible = h !== null;
    if (h) {
      dog.heart.position.set(0, 4, dog.at.top / DOG_SCALE + h.rise);
      dog.heart.lookAt(eye);
      if (!still) dog.heart.rotateY(Math.sin(t * 5) * 0.35);
      dog.heart.scale.setScalar(1.3 * (0.7 + 0.3 * Math.min(1, (now - dog.heartAt) / 180)));
      (dog.heart.material as THREE.MeshLambertMaterial).opacity = h.opacity;
      (dog.heart.material as THREE.MeshLambertMaterial).transparent = h.opacity < 1;
    }
    // A sleeper's "z", floating gently over it.
    dog.zed.visible = lie > 0.95 && h === null;
    if (dog.zed.visible) {
      const drift = still ? 0 : Math.sin(t * 1.3) * 1.4;
      dog.zed.position.set(3, 8, 17 + drift);
      dog.zed.lookAt(eye);
      dog.zed.scale.setScalar(1.15);
    }
  }

  private free(dog: Dog): void {
    for (const m of dog.mats) m.dispose();
    (dog.shadow.material as THREE.Material).dispose();
  }

  dispose(): void {
    for (const off of this.off) off();
    this.cursor(false);
    for (const dog of this.dogs.values()) {
      this.scene.remove(dog.root);
      this.free(dog);
    }
    this.dogs.clear();
  }
}
