'use client';

// Real 3D's game characters (docs/specs/008-canvas/3d-engine.md "Characters"): artist-made, rigged characters
// (./characters/*.glb, built by scripts/build-characters.mjs from Quaternius' Ultimate Modular Men and Women, CC0)
// dressed per look (lib/real-3d/game-look.ts) and played with their own idle, walk, run and wave, blended by how
// fast the character really moves; sitting, cheering and arms-out pose the skeleton on top. Each pack loads once, on
// first use, and only when 3D draws a character of it; until then the rig shows its own modelled character.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BODY } from '@/lib/real-3d/character';
import type { GameLook, GamePack } from '@/lib/real-3d/game-look';
import { gameFace } from './game-face';
import { smoothNormals } from '@/lib/real-3d/smooth-normals';
import { markFigure } from './figure-mark';

const URLS: Record<GamePack, string> = {
  men: new URL('./characters/men.glb', import.meta.url).href,
  women: new URL('./characters/women.glb', import.meta.url).href,
};

type Pack = { scene: THREE.Object3D; clips: Map<string, THREE.AnimationClip>; scale: number };

const packs = new Map<GamePack, Pack>();
const loading = new Map<GamePack, Promise<void>>();
const listeners = new Set<() => void>();

/** Calls back when a pack finishes loading (the rigs swap their stand-ins for it). */
export function onGamePack(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** Resolves once a pack has loaded (or failed to), for pages that draw once (the model sheet). */
export async function loadGamePack(pack: GamePack): Promise<void> {
  if (packs.has(pack)) return;
  gamePack(pack);
  await loading.get(pack);
}

/** The pack if loaded; otherwise starts loading it and answers null. */
export function gamePack(pack: GamePack): Pack | null {
  const have = packs.get(pack);
  if (have) return have;
  if (!loading.has(pack) && typeof window !== 'undefined') {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loading.set(
      pack,
      loader.loadAsync(URLS[pack]).then(
        (gltf) => {
          const scene = gltf.scene;
          // Lit as the rest of the scene is (Lambert, the scene's lights), every part casting its shadow.
          scene.traverse((o) => {
            const m = o as THREE.SkinnedMesh;
            if (!m.isMesh) return;
            // Smooth shading over the pack's facets; only the normals change (smooth-normals.ts).
            smoothNormals(m.geometry);
            const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((src) => {
              const s = src as THREE.MeshStandardMaterial;
              // The scene works in the drawings' own (sRGB) colours, unmanaged; glTF's are linear.
              const lam = new THREE.MeshLambertMaterial({
                color: s.color.clone().convertLinearToSRGB(),
                name: s.name,
              });
              // Marked for the ink pass: no ink across its facets inside its outline (the owner, 2026-11-27: "so many
              // polygons all over it").
              return markFigure(lam);
            });
            m.material = Array.isArray(m.material) ? mats : mats[0]!;
            m.castShadow = true;
            m.frustumCulled = false;
          });
          const box = new THREE.Box3().setFromObject(scene);
          const tall = Math.max(1e-6, box.max.y - box.min.y);
          packs.set(pack, {
            scene,
            clips: new Map(gltf.animations.map((c) => [c.name, c])),
            scale: BODY.height / tall,
          });
          // Called from a copy: a rig still waiting on the other pack signs up again from its callback, and a Set
          // visits what is added mid-loop, so walking the live Set never ended and hung the page.
          for (const f of [...listeners]) f();
        },
        () => {
          // A failed load keeps the modelled characters; a later look may try again.
          loading.delete(pack);
        },
      ),
    );
  }
  return null;
}

/** Each look's tinted materials, shared by everyone wearing it. */
const tinted = new Map<string, THREE.Material>();

/** The walk's own speed (sprite px a second) the run clip is played at as is, and the walk clip's. */
const RUN_AT = 104;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const WALK_AT = 44;
/**
 * Where a walk turns into a run (sprite px a second). Every size's walk (walk.ts AVATAR_SPEED, 55 sprite px a second
 * at Regular, 72 at Small) stays below it, so a walk is the walk clip alone; only a run (AVATAR_RUN_FACTOR) reaches it.
 * Below it a blend of the two clips, whose strides never line up, made the legs shuffle.
 */
const RUN_FROM = 78;
const RUN_FULL = 96;

/** One game character: its model, skeleton and animations, in sprite px about its feet. */
export class GameFigure {
  readonly object = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Record<'idle' | 'walk' | 'run' | 'wave', THREE.AnimationAction | null>;
  private readonly bones = new Map<string, THREE.Bone>();
  /** Where a prop goes: at the right wrist, kept upright in the character's space (z up, facing +y). */
  readonly hand: THREE.Object3D;
  private wrist: THREE.Bone | null = null;
  private readonly model: THREE.Object3D;
  /**
   * The build (3d-engine.md "Characters"): the width-and-depth scale, 1 at Regular. Off Regular, the model's width and
   * depth are scaled only once a frame's posing is done (`broaden`), so every pose is measured on the figure as it
   * always was; the head and the held prop are scaled back by the inverse so neither is stretched.
   */
  private readonly build: number;
  private readonly packScale: number;
  private head: THREE.Bone | null = null;
  /** The head bone's own scale-back: the inverse build on its two axes off the model's up, 1 along it. */
  private readonly headBack = new THREE.Vector3(1, 1, 1);
  private handScale = 1;
  private broadened = false;

  constructor(pack: Pack, look: GameLook) {
    const model = cloneSkinned(pack.scene);
    this.model = model;
    // three.js drops `:` and `.` from node names as it loads them (PropertyBinding.sanitizeNodeName).
    const name = (n: string) => THREE.PropertyBinding.sanitizeNodeName(n);
    const keep = new Set(look.parts.map(name));
    const drop: THREE.Object3D[] = [];
    // A part with several materials loads as a group of meshes, one per material, under the part's name.
    const partOf = (o: THREE.Object3D) => (keep.has(o.name) || !o.parent ? o.name : o.parent.name);
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o as THREE.Bone);
      if (!(o as THREE.Mesh).isMesh) return;
      const part = partOf(o);
      if (!keep.has(part)) {
        drop.push(o);
        return;
      }
      const m = o as THREE.SkinnedMesh;
      const list = Array.isArray(m.material) ? m.material : [m.material];
      const next = list.map((mat) => {
        const t = look.tints.find((x) => name(x.part) === part && x.material === mat.name);
        if (!t) return mat;
        const key = `${look.pack}/${part}/${mat.name}/${t.colour}`;
        let have = tinted.get(key);
        if (!have) {
          have = markFigure((mat as THREE.MeshLambertMaterial).clone());
          (have as THREE.MeshLambertMaterial).color.set(t.colour);
          tinted.set(key, have);
        }
        return have;
      });
      m.material = Array.isArray(m.material) ? next : next[0]!;
    });
    for (const o of drop) o.parent?.remove(o);
    // A face over the head's own slit eyes.
    const headPart = name(look.parts[0]);
    const headMeshes: THREE.SkinnedMesh[] = [];
    model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh && partOf(o) === headPart)
        headMeshes.push(o as THREE.SkinnedMesh);
    });
    const byMaterial = (n: string) =>
      headMeshes.find((m) => (m.material as THREE.Material).name === n);
    const eye = byMaterial('Eye');
    const skin = byMaterial('Skin');
    const headBone = this.bones.get('Head');
    if (eye && skin && headBone) {
      model.updateMatrixWorld(true);
      if (gameFace(eye, skin, skin.material as THREE.Material, headBone, look.face))
        eye.visible = false;
    }
    this.build = look.build;
    this.packScale = pack.scale;
    if (headBone && this.build !== 1) {
      // Which of the head bone's own axes runs up the model (glTF's +y) in its bind pose: the head keeps its scale
      // along it, and takes the inverse build across the other two.
      model.updateMatrixWorld(true);
      const q = headBone
        .getWorldQuaternion(new THREE.Quaternion())
        .premultiply(model.getWorldQuaternion(new THREE.Quaternion()).invert());
      const up = Y.clone().applyQuaternion(q.invert());
      const ax = [Math.abs(up.x), Math.abs(up.y), Math.abs(up.z)];
      const along = ax.indexOf(Math.max(...ax));
      this.headBack.setScalar(1 / this.build).setComponent(along, 1);
      this.head = headBone;
    }
    // glTF stands up +y and faces +z; the scene stands up +z and a character faces +y.
    model.rotation.set(Math.PI / 2, Math.PI, 0, 'XYZ');
    for (const s of ['L', 'R']) {
      const foot = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(`Foot.${s}`));
      if (foot) this.footBind.set(foot, { p: foot.position.clone(), q: foot.quaternion.clone() });
    }
    // The right hand's fingers, which no clip moves: restored each frame before a grip curls them, or the curl added
    // up frame on frame and the hand spun round the cup (the owner, 2026-11-27).
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky'])
      for (const n of [1, 2, 3]) {
        const b = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(`${f}${n}.R`));
        if (b) this.footBind.set(b, { p: b.position.clone(), q: b.quaternion.clone() });
      }
    model.scale.setScalar(pack.scale);
    this.object.add(model);
    // How far the body reaches behind its hip joints (the seat of its trousers), standing at rest: a sitter's hips go
    // that far in front of the seat's back, so the back meets the backrest instead of passing through it (the owner,
    // 2026-11-27: "he is merged with the back of the chair").
    this.object.updateMatrixWorld(true);
    const rest = new THREE.Box3().setFromObject(model, true);
    const hipRest = this.at('UpperLeg.L', new THREE.Vector3());
    this.backDepth = hipRest ? Math.max(0, hipRest.y - this.object.worldToLocal(rest.min).y) : 0;
    this.mixer = new THREE.AnimationMixer(model);
    const act = (name: string) => {
      const clip = pack.clips.get(name);
      if (!clip) return null;
      const a = this.mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      return a;
    };
    this.actions = { idle: act('Idle'), walk: act('Walk'), run: act('Run'), wave: act('Wave') };
    this.actions.idle?.setEffectiveWeight(1);
    this.hand = new THREE.Group();
    const wrist = this.bones.get('WristR');
    if (wrist) {
      // Props are made in sprite px; undo whatever scale the bone's space has.
      this.object.updateMatrixWorld(true);
      const k = wrist.getWorldScale(new THREE.Vector3()).x;
      this.handScale = 1 / Math.max(1e-6, k);
      this.hand.scale.setScalar(this.handScale);
      // Held in the palm, not at the wrist joint (the owner, 2026-11-27: "its attached to my arm not my hand"): the
      // grip is partway along the middle finger's first bone, where a closed hand holds a cup's handle.
      const m1 = this.bones.get('Middle1R');
      const m2 = this.bones.get('Middle2R');
      if (m1)
        this.hand.position
          .copy(m1.position)
          .addScaledVector(m2?.position ?? m1.position, m2 ? 0.55 : 0);
      wrist.add(this.hand);
      this.wrist = wrist;
    }
    this.broaden(true);
  }

  /**
   * Puts the build on (after a frame's posing) or takes it off (before the next), so the posing never sees it. Nothing
   * at Regular, which is drawn exactly as it always was.
   */
  private broaden(on: boolean): void {
    if (this.build === 1 || on === this.broadened) return;
    this.broadened = on;
    const b = this.build;
    const s = this.packScale;
    if (on) {
      this.model.scale.set(s * b, s, s * b);
      this.head?.scale.multiply(this.headBack);
      // The prop's own axes are the character's (x across, y facing, z up): back across and front to back.
      this.hand.scale.set(this.handScale / b, this.handScale / b, this.handScale);
      // A sitter's knees and hips, measured unbroadened, keep their place over the seat.
      this.model.position.x *= b;
      this.model.position.y *= b;
    } else {
      this.model.scale.setScalar(s);
      this.head?.scale.divide(this.headBack);
      this.hand.scale.setScalar(this.handScale);
    }
  }

  /**
   * Plays this frame: `speed` sprite px a second; `waving` plays the wave; the pose's arms and legs go on top.
   * Answers nothing; the skeleton is posed in place.
   */
  update(
    dt: number,
    speed: number,
    o: {
      seated: boolean;
      waving: boolean;
      armsUp?: boolean;
      armsOut?: boolean;
      legsApart?: boolean;
      holding?: boolean;
      flag?: boolean;
      /** Off the ground mid-jump: knees tucked, no stride (the owner, 2026-11-27: "when jumping my feet aren't walking"). */
      airborne?: boolean;
      /** How high the seat is, in this figure's space: a sitter's hips rest on it. */
      seatHeight: number;
      /** Lying on the seat (a hammock) rather than sitting: on their back along it, legs straight. */
      lying?: boolean;
      /** How far behind the feet the hips rest, in this figure's space, when the seat's back sets it. */
      hipsBack?: number;
    },
  ): void {
    this.broaden(false);
    const { idle, walk, run, wave } = this.actions;
    const moving = o.seated || o.airborne ? 0 : speed;
    // Idle to walk to run, cross-faded by speed; each clip played at the pace that keeps its feet planted.
    const w = Math.min(1, moving / WALK_AT);
    const r = Math.min(1, Math.max(0, (moving - RUN_FROM) / (RUN_FULL - RUN_FROM)));
    const waving = o.waving && moving < 1;
    idle?.setEffectiveWeight(waving ? 0 : 1 - w);
    walk?.setEffectiveWeight(waving ? 0 : w * (1 - r));
    run?.setEffectiveWeight(waving ? 0 : w * r);
    wave?.setEffectiveWeight(waving ? 1 : 0);
    if (walk) walk.timeScale = moving > 1 ? Math.min(1.8, Math.max(0.5, moving / WALK_AT)) : 1;
    if (run) run.timeScale = moving > 1 ? Math.min(1.5, Math.max(0.7, moving / RUN_AT)) : 1;
    // Clips that leave the feet (and the fingers) alone would keep where a pose last carried them.
    for (const [foot, bind] of this.footBind) {
      foot.position.copy(bind.p);
      foot.quaternion.copy(bind.q);
    }
    this.mixer.update(dt);
    // While both clips show, the run keeps the walk's place in its stride, so their feet land together.
    if (walk && run && r > 0 && r < 1) {
      const wd = walk.getClip().duration;
      const rd = run.getClip().duration;
      if (wd > 0 && rd > 0) run.time = ((walk.time % wd) / wd) * rd;
    }
    // Poses the clips don't have, set over them: each a turn about an axis of the character's own space (x across
    // its shoulders, y the way it faces, z up), whatever way the bone's own axes lie.
    this.model.position.set(0, 0, 0);
    // The reactions' arms and legs ease to where they go (a jack's arms sweep up, never snap to a T).
    const ease = Math.min(1, dt * 14);
    const armTo = o.armsUp ? 2.7 : o.armsOut ? 2.35 : 0;
    this.armL += (armTo - this.armL) * ease;
    this.armR += ((o.flag && !o.armsUp && !o.armsOut ? 2.6 : armTo) - this.armR) * ease;
    this.legs += ((o.legsApart ? 0.32 : 0) - this.legs) * ease;
    this.tuck += ((o.airborne && !o.seated ? 1 : 0) - this.tuck) * Math.min(1, dt * 18);
    if (o.lying) {
      // On their back along the seat, centred on its spot: turned a quarter about their shoulders, head away from
      // where they face, lifted onto the fabric (3d-engine.md "Sitting fits the figure").
      this.object.rotation.set(Math.PI / 2, 0, 0);
      this.object.position.set(0, BODY.height / 2, o.seatHeight + BODY.height * 0.08);
      this.posed({ ...o, seated: false });
    } else {
      this.object.rotation.set(0, 0, 0);
      this.posed(o);
    }
    // The prop stays upright whatever the wrist does.
    if (this.wrist && this.hand.children.length > 0) {
      this.object.updateMatrixWorld(true);
      const w = this.wrist.getWorldQuaternion(this.q1).invert();
      this.hand.quaternion.copy(w.multiply(this.object.getWorldQuaternion(this.q2)));
    }
    this.broaden(true);
  }

  private posed(o: Parameters<GameFigure['update']>[2]): void {
    const pose =
      o.seated ||
      o.holding ||
      this.armL > 0.01 ||
      this.armR > 0.01 ||
      this.legs > 0.01 ||
      this.tuck > 0.01;
    if (!pose) return;
    this.object.updateMatrixWorld(true);
    this.object.getWorldQuaternion(this.q0).invert();
    const turn = (name: string, axis: THREE.Vector3, angle: number) => {
      const b = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(name));
      if (!b?.parent) return;
      // The parent's turn in the character's space; the bone turned by `angle` about `axis` in that space.
      const parent = b.parent.getWorldQuaternion(this.q1).premultiply(this.q0);
      const r = this.q2.setFromAxisAngle(axis, angle);
      b.quaternion.premultiply(parent.clone().invert().multiply(r).multiply(parent));
      b.updateMatrixWorld(true);
    };
    /** Which side a bone is on: +1 at +x, -1 at -x, in the character's space. */
    const side = (name: string) => {
      const b = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(name));
      if (!b) return 1;
      const p = b.getWorldPosition(this.v0);
      this.object.worldToLocal(p);
      return p.x >= 0 ? 1 : -1;
    };
    // This rig's feet hang from its root, not its shins (they plant the walk): wherever the legs are turned, each foot
    // is carried to its shin's end after, or it stays on the floor while its leg sits or spreads.
    const legsTurned = o.seated || this.legs > 0.01 || this.tuck > 0.01;
    if (legsTurned) this.footHold();
    if (o.seated) {
      // Thighs forward level with the seat, measured on this character's own bones: its hips rest on the seat, its
      // knees over the seat's spot, and its shins reach down to the floor, angled forward when they are longer than
      // the seat is high (a tall figure on a low chair), so no foot goes through the floor.
      const knee0 = this.at('LowerLeg.L', this.v1);
      const foot0 = this.at('Foot.L', this.v2);
      const shin = knee0 && foot0 ? knee0.distanceTo(foot0) : 0;
      const ankle = foot0 ? foot0.z : 0;
      for (const s of ['L', 'R']) turn(`UpperLeg.${s}`, X, Math.PI / 2);
      const hip = this.at('UpperLeg.L', this.v1);
      const lift = hip ? o.seatHeight - hip.z : 0;
      const knee = this.at('LowerLeg.L', this.v2);
      const drop = knee ? knee.z + lift - ankle : 0;
      const tilt = shin > drop && drop > 0 ? Math.acos(drop / shin) : 0;
      for (const s of ['L', 'R']) turn(`LowerLeg.${s}`, X, -(Math.PI / 2 - tilt));
      // Knees over the seat's spot, unless that would sit the hips into the seat's back: then the hips go just short
      // of it, the knees forward of the spot.
      const kneesAt = knee ? -knee.y : 0;
      const hipsAt =
        hip && o.hipsBack !== undefined ? -o.hipsBack + this.backDepth - hip.y : kneesAt;
      this.model.position.set(0, Math.max(kneesAt, hipsAt), lift);
    }
    const raise = (s: 'L' | 'R', angle: number) =>
      turn(`UpperArm.${s}`, Y, -side(`UpperArm.${s}`) * angle);
    if (this.armL > 0.01) raise('L', this.armL);
    if (this.armR > 0.01) raise('R', this.armR);
    if (this.legs > 0.01 && !o.seated)
      for (const s of ['L', 'R'] as const)
        turn(`UpperLeg.${s}`, Y, -side(`UpperLeg.${s}`) * this.legs);
    // A jump: knees drawn up a little under the body and the arms lifted out for balance, eased in and out.
    if (this.tuck > 0.01 && !o.seated) {
      for (const s of ['L', 'R'] as const) {
        turn(`UpperLeg.${s}`, X, 0.55 * this.tuck);
        turn(`LowerLeg.${s}`, X, -0.95 * this.tuck);
      }
      if (this.armL <= 0.01) raise('L', 0.45 * this.tuck);
      if (this.armR <= 0.01 && !o.holding) raise('R', 0.45 * this.tuck);
    }
    if (legsTurned) this.footFollow();
    if (this.armR <= 0.01 && o.holding) {
      // Carried at the waist (the owner, 2026-11-27): the upper arm by the side, the forearm bent up and forward,
      // and the fingers closed round the drink.
      turn('UpperArm.R', X, 0.05);
      turn('LowerArm.R', X, 1.25);
      for (const f of ['Index', 'Middle', 'Ring', 'Pinky'])
        for (const n of [1, 2, 3]) turn(`${f}${n}.R`, X, -0.55);
    }
  }

  /** The arms' raise and the legs' spread now (radians), easing toward the pose's. */
  private armL = 0;
  private armR = 0;
  private legs = 0;
  private tuck = 0;
  private readonly q0 = new THREE.Quaternion();
  private readonly q1 = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly v0 = new THREE.Vector3();
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();

  /** Each foot's bind pose, put back before the clips play. */
  private readonly footBind = new Map<THREE.Bone, { p: THREE.Vector3; q: THREE.Quaternion }>();
  /** Each foot's place in its shin's frame, taken before the legs turn. */
  private readonly feet = new Map<THREE.Bone, { shin: THREE.Bone; at: THREE.Vector3 }>();

  private footHold(): void {
    for (const s of ['L', 'R']) {
      const shin = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(`LowerLeg.${s}`));
      const foot = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(`Foot.${s}`));
      if (!shin || !foot) continue;
      const held = this.feet.get(foot) ?? { shin, at: new THREE.Vector3() };
      shin.worldToLocal(foot.getWorldPosition(held.at));
      this.feet.set(foot, held);
    }
  }

  private footFollow(): void {
    this.object.updateMatrixWorld(true);
    for (const [foot, { shin, at }] of this.feet) {
      if (!foot.parent) continue;
      foot.position.copy(foot.parent.worldToLocal(shin.localToWorld(this.v3.copy(at))));
      foot.updateMatrixWorld(true);
    }
  }

  /** Where a bone is now, in this figure's space (null when the pack has no such bone). */
  /** How far the body reaches behind its hip joints at rest, in the figure's own units (set once, on load). */
  private readonly backDepth: number;

  private at(name: string, into: THREE.Vector3): THREE.Vector3 | null {
    const b = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(name));
    return b ? this.object.worldToLocal(b.getWorldPosition(into)) : null;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
  }
}
