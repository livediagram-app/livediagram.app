'use client';

// Real 3D's character rig (docs/specs/008-canvas/3d-engine.md "Characters"): a character's parts (lib/real-3d/
// character.ts) hung on joints, posed every frame from what the walker says it is doing: a smooth walk cycle while it
// walks, sat on a seat, a raised flag, a cup in hand, and each reaction's arms and legs. Only the joints' angles change
// per frame; the geometry is built once per look and shared by everyone who wears it.

import * as THREE from 'three';
import { ownNormals } from './scene-look';
import { solidBothSides } from './figure-mark';
import {
  BODY,
  characterParts,
  type CharacterPart,
  type CharacterLook,
} from '@/lib/real-3d/character';
import type { MeshBuilder } from '@/lib/real-3d/mesh-builder';
import { RISE, SEAT_Z } from '@/lib/real-3d/models/kit';
import { cadence, gaitPose } from '@/lib/real-3d/gait';
import { gameLook, gameLookKey } from '@/lib/real-3d/game-look';
import { GameFigure, gamePack, onGamePack } from './game-figure';
import { parseAvatarStatus } from '@livehuddle/avatar/status';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import {
  easeGestures,
  gesturesOf,
  NO_GESTURES,
  poseGestures,
  type Gestures,
} from './figure-gestures';
import { handProp, StatusProps, statusHandProp, type StatusHandProp } from './status-props';

/** The walk's own speed in sprite px a second (walk.ts AVATAR_SPEED over its 2.5 px sprite pixel). */
export const WALK_SPEED = 260 / 2.5;

/** What a walker says its character is doing (AvatarWalker's `data-figure`). */
export type WalkerPose = RigPose & {
  facing: 'down' | 'up' | 'left' | 'right';
  config: unknown;
  shirt?: string;
};

/** What the rig poses from. */
export type RigPose = {
  walking: boolean;
  seated: boolean;
  lift: number;
  wave: number | null;
  holding: unknown;
  pose: {
    armsOut?: boolean;
    armsUp?: boolean;
    waveArm?: boolean;
    legsApart?: boolean;
    handUp?: boolean;
    clap?: number;
    thumbsUp?: boolean;
    point?: boolean;
  } | null;
  /** A raised hand (avatar-mode.md "Raise Hand"), held apart from any Behaviour. */
  handUp?: boolean;
  /** The status, as the walker says it (parsed here): its signature's props (status-props.ts). */
  status?: unknown;
};

type Geometries = Record<
  'torso' | 'armL' | 'armR' | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'footL' | 'footR',
  THREE.BufferGeometry
> & { skirt: THREE.BufferGeometry | null };

function geometryOf(b: MeshBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.colours, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  return g;
}

/** Each look's geometries, built once and kept (bounded, oldest out). */
export class CharacterKit {
  private readonly built = new Map<string, Geometries>();
  /** A lit material for characters drawn outside a scene's own (the model sheet). */
  readonly material = ownNormals(
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  private readonly cap: number;
  constructor(cap = 48) {
    this.cap = cap;
  }

  geometries(key: string, look: CharacterLook): Geometries {
    const have = this.built.get(key);
    if (have) return have;
    const p = characterParts(look);
    const g: Geometries = {
      torso: geometryOf(p.torso.mesh),
      armL: geometryOf(p.armL.mesh),
      armR: geometryOf(p.armR.mesh),
      thighL: geometryOf(p.thighL.mesh),
      thighR: geometryOf(p.thighR.mesh),
      shinL: geometryOf(p.shinL.mesh),
      shinR: geometryOf(p.shinR.mesh),
      footL: geometryOf(p.footL.mesh),
      footR: geometryOf(p.footR.mesh),
      skirt: p.skirt ? geometryOf(p.skirt.mesh) : null,
    };
    this.built.set(key, g);
    if (this.built.size > this.cap) {
      const first = this.built.keys().next().value as string;
      const old = this.built.get(first);
      this.built.delete(first);
      if (old) dispose(old);
    }
    return g;
  }

  dispose(): void {
    for (const g of this.built.values()) dispose(g);
    this.built.clear();
  }
}

function dispose(g: Geometries): void {
  for (const v of Object.values(g)) v?.dispose();
}

const PIVOTS = characterParts({});

const at = (p: CharacterPart) => new THREE.Vector3(p.pivot[0], p.pivot[1], p.pivot[2]);

/** One character's joints, in sprite pixels (its group is scaled to canvas px). */
export class CharacterRig {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly kneeL = new THREE.Group();
  private readonly kneeR = new THREE.Group();
  private readonly ankleL = new THREE.Group();
  private readonly ankleR = new THREE.Group();
  private readonly skirtJoint = new THREE.Group();
  private readonly prop = new THREE.Group();
  private meshes: THREE.Mesh[] = [];
  private key = '';
  private phase = 0;
  private speed = 0;
  private lean = 0;

  private readonly material: THREE.Material;
  constructor(material: THREE.Material) {
    this.material = material;
    this.root.add(this.body);
    this.body.add(this.hips, this.legL, this.legR, this.skirtJoint);
    this.hips.position.copy(at(PIVOTS.torso));
    this.armL.position.copy(at(PIVOTS.armL));
    this.armR.position.copy(at(PIVOTS.armR));
    this.hips.add(this.armL, this.armR);
    this.legL.position.copy(at(PIVOTS.thighL));
    this.legR.position.copy(at(PIVOTS.thighR));
    this.kneeL.position.copy(at(PIVOTS.shinL));
    this.kneeR.position.copy(at(PIVOTS.shinR));
    this.legL.add(this.kneeL);
    this.legR.add(this.kneeR);
    this.ankleL.position.copy(at(PIVOTS.footL));
    this.ankleR.position.copy(at(PIVOTS.footR));
    this.kneeL.add(this.ankleL);
    this.kneeR.add(this.ankleR);
    this.skirtJoint.position.set(0, 0, BODY.hip);
    this.armR.add(this.prop);
    this.prop.position.set(0, 0, -BODY.arm - 0.4);
  }

  private look: CharacterLook | null = null;
  private game: GameFigure | null = null;
  private gameKey = '';
  private waiting: (() => void) | null = null;

  /**
   * Dresses the rig in a look (only when the look changes): its game character once that pack has loaded
   * (game-figure.ts), its modelled geometries until then.
   */
  wear(key: string, g: Geometries, look?: CharacterLook): void {
    if (look) {
      this.look = look;
      this.dressGame();
    }
    if (key === this.key) return;
    this.key = key;
    for (const m of this.meshes) m.parent?.remove(m);
    const mesh = (geo: THREE.BufferGeometry, parent: THREE.Object3D) => {
      const m = new THREE.Mesh(geo, this.material);
      m.castShadow = true;
      m.frustumCulled = false;
      parent.add(m);
      this.meshes.push(m);
    };
    this.meshes = [];
    mesh(g.torso, this.hips);
    mesh(g.armL, this.armL);
    mesh(g.armR, this.armR);
    mesh(g.thighL, this.legL);
    mesh(g.thighR, this.legR);
    mesh(g.shinL, this.kneeL);
    mesh(g.shinR, this.kneeR);
    mesh(g.footL, this.ankleL);
    mesh(g.footR, this.ankleR);
    if (g.skirt) mesh(g.skirt, this.skirtJoint);
  }

  /** Swaps in the look's game character when its pack is ready (and waits for it when not). */
  private dressGame(): void {
    if (!this.look) return;
    const gl = gameLook(this.look);
    const key = gameLookKey(gl);
    if (key === this.gameKey) return;
    const pack = gamePack(gl.pack);
    if (!pack) {
      this.waiting ??= onGamePack(() => {
        this.waiting?.();
        this.waiting = null;
        this.dressGame();
      });
      return;
    }
    this.gameKey = key;
    if (this.game) {
      this.root.remove(this.game.object);
      this.game.dispose();
    }
    this.game = new GameFigure(pack, gl);
    this.root.add(this.game.object);
    this.body.visible = false;
    this.game.hand.add(this.prop);
    this.prop.position.set(0, 0, 0);
    this.uprightProp();
    // A status's props (status-props.ts): the head's on an anchor at the head bone, the hand's beside a drink.
    this.statusProps = new StatusProps(this.game);
    this.statusProps.show(this.status);
    this.game.hand.add(this.carry);
    this.carry.rotation.set(-Math.PI / 2, 0, 0);
    this.gestures = NO_GESTURES;
  }

  private statusProps: StatusProps | null = null;
  private status: ReturnType<typeof parseAvatarStatus> = null;

  /** How high the head reaches over the feet (hair, or a worn head prop), in sprite px, measured on the dressed game
   *  character (StatusProps.reach); null while the modelled stand-in is worn. The chip over the head clears it. */
  headReach(): number | null {
    return this.game ? (this.statusProps?.reach() ?? null) : null;
  }
  /** A status's hand prop (the sandwich, the bottle, the phone), each made the first time it is carried. */
  private readonly carry = new THREE.Group();
  private readonly carried = new Map<StatusHandProp, THREE.Object3D>();
  private gestures: Gestures = NO_GESTURES;

  /** Carries a status's hand prop, or nothing. */
  private carryProp(kind: StatusHandProp | null): void {
    let want: THREE.Object3D | null = null;
    if (kind) {
      want = this.carried.get(kind) ?? null;
      if (!want) this.carried.set(kind, (want = handProp(kind)));
    }
    if ((this.carry.children[0] ?? null) === want) return;
    this.carry.clear();
    if (want) this.carry.add(want);
  }

  /** Lets go of what the rig holds on to (its animations, its wait for a pack). */
  dispose(): void {
    this.waiting?.();
    this.waiting = null;
    this.game?.dispose();
  }

  private held: 'cup' | 'flag' | null = null;
  private uprightProp(): void {
    if (!this.game) return;
    this.prop.rotation.set(this.held === 'flag' ? Math.PI : -Math.PI / 2, 0, 0);
    this.prop.position.set(0, 0, 0);
  }

  private readonly drinks = new Map<string, THREE.Object3D>();
  private flag: THREE.Object3D | null = null;

  /**
   * Holds a prop in the right hand: a drink (`drink` says which: a coffee mug, a water cup, a juice glass, a soda
   * can), a flag, or nothing (each made the first time it is held).
   */
  hold(what: 'cup' | 'flag' | null, drink?: string | null): void {
    let want: THREE.Object3D | null = null;
    if (what === 'cup') {
      const kind = drink ?? 'coffee';
      want = this.drinks.get(kind) ?? null;
      if (!want) this.drinks.set(kind, (want = this.game ? drinkProp(kind) : cupProp()));
    }
    if (what === 'flag') want = this.flag ??= flagProp();
    if ((this.prop.children[0] ?? null) === want) return;
    this.prop.clear();
    if (want) this.prop.add(want);
    // A game character's hand is upright: the flag's pole points up from it, the mug stands in it.
    this.held = what;
    this.uprightProp();
  }

  /**
   * Poses the joints for this frame. `dt` is the seconds since the last frame; `unit` the canvas px per sprite
   * pixel, for the seat's height. `motion` is how fast the character really moves (sprite px a second) and turns
   * (radians a second, left positive); without it a walking pose strides at the walk's own speed.
   */
  pose(
    p: RigPose,
    dt: number,
    unit: number,
    now: number,
    motion?: { speed: number; turn: number },
    /** The seat under a sitter, from the scene (canvas px high, and whether it is one to lie on), if found. */
    seat?: { height: number; lying: boolean; hipsBack: number | null } | null,
  ): void {
    const r = p.pose;
    const moving = !p.seated && !r && (motion ? motion.speed : p.walking ? WALK_SPEED : 0);
    // The speed eases (a stride never jumps), and the stride's phase runs on with the ground covered.
    this.speed += ((moving || 0) - this.speed) * Math.min(1, dt * 8);
    if (this.speed < 0.05) this.speed = 0;
    if (this.game) {
      const g = this.game;
      g.object.position.set(0, 0, 0);
      // The status's signature (avatar-mode.md "Status"): its head props, and its hand prop while nothing else holds
      // the hand (a drink, a Behaviour or a raised hand takes it first; lying in a hammock carries nothing).
      this.status = parseAvatarStatus(p.status);
      this.statusProps?.show(this.status);
      const still = this.status !== null && prefersReducedMotion();
      this.statusProps?.animate(now, still);
      const handUp = !!p.handUp || !!r?.handUp;
      const lying = p.seated && !!seat?.lying;
      const kind = !p.holding && !r && !handUp && !lying ? statusHandProp(this.status) : null;
      this.carryProp(kind);
      // A raised hand is an empty one: a drink waits, hidden, until it comes down.
      this.prop.visible = !handUp;
      const carrying = kind === 'sandwich' || kind === 'bottle';
      // Out to Lunch: a bite every few seconds (none under reduced motion).
      const bitePhase = (now % LUNCH_BITE_EVERY_MS) / LUNCH_BITE_EVERY_MS;
      const bite =
        kind === 'sandwich' && !still && bitePhase > LUNCH_BITE_FROM
          ? Math.sin((Math.PI * (bitePhase - LUNCH_BITE_FROM)) / (1 - LUNCH_BITE_FROM))
          : 0;
      g.update(dt, this.speed, {
        seated: p.seated,
        waving: !!r?.waveArm,
        armsUp: r?.armsUp,
        armsOut: r?.armsOut,
        legsApart: r?.legsApart,
        holding: (!!p.holding || carrying) && !r && !handUp,
        // No flag on a jump (the owner, 2026-11-27: "when I jump don't wave a flag ... just make me jump naturally").
        airborne: p.lift > 0.5 && !r,
        seatHeight: (seat?.height ?? SEAT_Z * RISE) / unit,
        lying: p.seated && !!seat?.lying,
        hipsBack: seat?.hipsBack != null ? seat.hipsBack / unit : undefined,
      });
      // The newer Behaviours' arms and the status's hand pose, over what the figure just posed (figure-gestures.ts).
      this.gestures = easeGestures(
        this.gestures,
        { ...gesturesOf(r, kind === 'phone'), handUp: handUp && !lying ? 1 : 0, bite },
        dt,
      );
      poseGestures(g, this.gestures);
      return;
    }
    this.phase = (this.phase + dt * cadence(this.speed)) % 1;
    const g = gaitPose(this.phase, this.speed);
    // Leaning into a turn, as a runner banks into a bend.
    const bank = motion ? Math.max(-0.22, Math.min(0.22, -motion.turn * this.speed * 0.0035)) : 0;
    this.lean += (bank - this.lean) * Math.min(1, dt * 6);
    let hipL = g.hipL;
    let hipR = g.hipR;
    let kneeL = g.kneeL;
    let kneeR = g.kneeR;
    let spread = 0;
    this.body.position.set(g.bodyX, 0, g.bodyZ);
    this.body.rotation.set(0, this.lean, 0);
    this.hips.rotation.set(-g.lean, 0, g.twist);
    if (p.seated) {
      hipL = hipR = Math.PI / 2;
      kneeL = kneeR = -Math.PI / 2;
      // Hips at the seat's height, feet on the seat's spot.
      const seat = (SEAT_Z * RISE) / unit;
      this.body.position.set(0, -BODY.thigh, seat - BODY.hip);
      this.body.rotation.set(0, 0, 0);
      this.hips.rotation.set(-0.05, 0, 0);
    } else if (r?.legsApart) spread = 0.32;
    this.legL.rotation.set(hipL, g.rollL - spread, 0);
    this.legR.rotation.set(hipR, g.rollR + spread, 0);
    this.kneeL.rotation.x = -kneeL;
    this.kneeR.rotation.x = -kneeR;
    // The shoe keeps its own pitch to the floor (flat when planted), whatever the leg above it does.
    this.ankleL.rotation.x = p.seated ? 0 : g.footL - (hipL - kneeL);
    this.ankleR.rotation.x = p.seated ? 0 : g.footR - (hipR - kneeR);
    // Arms: swinging opposite the legs, or the reaction's, or holding up a flag or a cup.
    let armL = new THREE.Euler(g.armL, g.armOut, 0);
    let armR = new THREE.Euler(g.armR, -g.armOut, 0);
    if (p.seated) {
      armL = new THREE.Euler(0.55, 0, 0.1);
      armR = new THREE.Euler(0.55, 0, -0.1);
    }
    if (r?.armsUp) {
      armL = new THREE.Euler(0, 2.75, 0);
      armR = new THREE.Euler(0, -2.75, 0);
    } else if (r?.armsOut) {
      armL = new THREE.Euler(0, 1.45, 0);
      armR = new THREE.Euler(0, -1.45, 0);
    }
    if (r?.waveArm) armR = new THREE.Euler(0, -2.55 + Math.sin(now * 0.012) * 0.35, 0);
    if (p.wave !== null) armR = new THREE.Euler(0, -2.7, 0);
    else if (p.holding && !r) armR = new THREE.Euler(0.95, 0, -0.08);
    this.armL.rotation.copy(armL);
    this.armR.rotation.copy(armR);
  }
}

/** Out to Lunch's bite: once every this many ms, the sandwich lifted over the last part of it. */
const LUNCH_BITE_EVERY_MS = 4000;
const LUNCH_BITE_FROM = 0.78;

/** A cup held in the hand: a mug with a handle. */
export function cupProp(colour = 0xf8fafc): THREE.Object3D {
  const g = new THREE.Group();
  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 0.95, 2.2, 14),
    solidBothSides(new THREE.MeshLambertMaterial({ color: colour })),
  );
  mug.rotation.x = Math.PI / 2;
  mug.position.set(0, 1.2, -0.4);
  mug.castShadow = true;
  g.add(mug);
  return g;
}

/**
 * A drink held in a game character's hand, life-sized beside it (a mug is a little under half a head high), its
 * middle a hand's width out from the grip on the thumb side so the fingers close round it rather than through it.
 * Made upright along +y.
 */
export function drinkProp(kind: string): THREE.Object3D {
  const g = new THREE.Group();
  const lam = (c: number) => solidBothSides(new THREE.MeshLambertMaterial({ color: c }));
  const along = (m: THREE.Mesh, z: number) => {
    m.position.y = z;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (kind === 'soda') {
    along(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 16), lam(0xdc2626)), 0);
    along(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.12, 16), lam(0xd4d4d8)), 0.8);
  } else if (kind === 'juice') {
    along(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1.5, 16), lam(0xe0f2fe)), 0);
    along(new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.42, 1.1, 16), lam(0xf59e0b)), -0.15);
  } else if (kind === 'water') {
    along(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 1.3, 16), lam(0xf8fafc)), 0);
    along(new THREE.Mesh(new THREE.CircleGeometry(0.47, 16), lam(0x7dd3fc)), 0.55).rotation.x =
      -Math.PI / 2;
  } else {
    // Coffee: a mug with the coffee at its brim and a handle on the side the hand holds.
    along(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 1.25, 16), lam(0xf8fafc)), 0);
    along(new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), lam(0x5b3a24)), 0.56).rotation.x =
      -Math.PI / 2;
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.09, 6, 12, Math.PI),
      lam(0xf8fafc),
    );
    handle.rotation.set(0, 0, -Math.PI / 2);
    handle.position.set(0.52, 0, 0);
    g.add(handle);
  }
  const held = new THREE.Group();
  g.position.set(0, 0, 0);
  held.add(g);
  return held;
}

/** A flag held up: a pole and a red cloth that ripples. */
export function flagProp(): THREE.Object3D {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 11, 8),
    solidBothSides(new THREE.MeshLambertMaterial({ color: 0xb8845a })),
  );
  pole.rotation.x = Math.PI / 2;
  pole.position.set(0, 0, -3.5);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3.4, 6, 1),
    new THREE.MeshLambertMaterial({ color: 0xf43f5e, side: THREE.DoubleSide }),
  );
  cloth.rotation.x = Math.PI / 2;
  cloth.position.set(-2.6, 0, -7.6);
  cloth.castShadow = true;
  g.add(pole, cloth);
  return g;
}
