'use client';

// Real 3D (docs/specs/008-canvas/3d-engine.md): the 3D view drawn as a real WebGL scene over the tilted floor. The
// floor stays the DOM's; walls, roofs, pieces and characters are geometry with a depth buffer, so what is nearer the
// camera hides what is behind it at every height. Loaded on first use (next/dynamic), so neither 2D nor the editor's
// first load carries three.js.
//
// The camera is the stage's own: each frame the stage's and world layer's computed transforms (the tilt's and turn's
// easing included) become the projection, so the scene lines up with the floor and with the chips and bubbles drawn
// over it. Characters are read from their walkers in the DOM (where they stand, mid-glide included, and the pose
// their sprite draws), so peers, the Receptionist and you are all built the same way, from shared state only.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Element } from '@livehuddle/document';
import { spaceWalls } from '@/lib/space-3d/space-3d-walls';
import { spaceRoofs, roofOver } from '@/lib/space-3d/space-3d-roofs';
import { cutAwayIds, spaceRooms, SPACE_CUT_OPACITY } from '@/lib/space-3d/space-3d-cutaway';
import { clipMatrix, DEPTH_K, scaleZ } from '@/lib/real-3d/projection';
import { SPACE_3D_PERSPECTIVE_PX } from '@/lib/space-3d/space-3d-camera';
import { createOutlinePass, type OutlinePass } from './outline-pass';
import { createLook, type Look } from './scene-look';
import { wallMesh, roofMesh, wallPalette, type WallPalette } from '@/lib/real-3d/scene-walls';
import { piecesMesh } from '@/lib/real-3d/scene-pieces';
import { pickPiece } from '@/lib/real-3d/piece-pick';
import { setReal3DPicker } from '@/lib/real-3d/real-3d-pick';
import type { MeshBuilder } from '@/lib/real-3d/mesh-builder';
import { lookKey, type CharacterLook } from '@/lib/real-3d/character';
import { CharacterKit, CharacterRig, type WalkerPose } from './character-rig';
import { MomentFx } from './moment-fx';
import { SelectionMarks } from './selection-marks';
import { floorPointer } from '@/lib/space-3d/floor-pointer';
import { useOptionalSelectionStore } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { selectionIds } from '@liveworkspace/workbench/lib/selection-store';
import type { PieceBounds } from '@/lib/real-3d/piece-pick';
import { hasMoment, latestMoments, subscribeMoments } from '@/lib/piece-moments';

/** Screen px per drawn px: the scene is drawn at a quarter of the pixels and scaled up with hard edges. */
/** The scene draws at the screen's own resolution, so edges are as crisp as the flat drawings. */
const MAX_RATIO = 2;
/** The sprite's pixel, in canvas px at size 1 (walk.ts AVATAR_UNIT). */
const SPRITE_UNIT = 60 / 24;
/** The walker's box: where its feet are inside it, per unit of scale (walk.ts avatarBox). */
const FEET_X = 13 * SPRITE_UNIT;
const FEET_Y = 56 + 80;
const OUTLINE = 0x2b2438;
/** A wall's materials' own look, in the order the wall keeps them: solid, glass, line. */
const BASE_LOOK = [
  { opacity: 1, depthWrite: true },
  { opacity: 0.22, depthWrite: false },
  { opacity: 0.3, depthWrite: false },
] as const;

type Props = {
  elements: readonly Element[];
  /** The camera's quarter turns, for the walls cut away in front of you. */
  turn: number;
  /** A changing value whenever the palette's tokens may have changed (theme, wall colour). */
  paletteKey: string;
};

const YAW: Record<WalkerPose['facing'], number> = {
  down: 0,
  left: Math.PI / 2,
  up: Math.PI,
  right: -Math.PI / 2,
};

function geometryOf(b: MeshBuilder, glass = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(glass ? b.glassPositions : b.positions, 3),
  );
  g.setAttribute('color', new THREE.Float32BufferAttribute(glass ? b.glassColours : b.colours, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(glass ? b.glassNormals : b.normals, 3));
  return g;
}

function linesOf(b: MeshBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.lines, 3));
  return g;
}

type Built = { group: THREE.Group; dispose: () => void };

function buildGroup(
  b: MeshBuilder,
  mats: { solid: THREE.Material; glass: THREE.Material; line: THREE.Material },
): Built {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  if (b.positions.length) {
    const g = geometryOf(b);
    geos.push(g);
    const solid = new THREE.Mesh(g, mats.solid);
    solid.castShadow = true;
    solid.receiveShadow = true;
    group.add(solid);
  }
  if (b.glassPositions.length) {
    const g = geometryOf(b, true);
    geos.push(g);
    const mesh = new THREE.Mesh(g, mats.glass);
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  if (b.lines.length) {
    const g = linesOf(b);
    geos.push(g);
    group.add(new THREE.LineSegments(g, mats.line));
  }
  for (const o of group.children) o.frustumCulled = false;
  return { group, dispose: () => geos.forEach((g) => g.dispose()) };
}

type Figure = {
  group: THREE.Group;
  rig: CharacterRig;
  shadow: THREE.Mesh;
  /** The way it faces now, turning toward where it is going rather than snapping. */
  yaw: number;
};

export default function Real3DLayer({ elements, turn, paletteKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engine = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    outline: OutlinePass;
    look: Look;
    mats: {
      solid: THREE.MeshLambertMaterial;
      glass: THREE.MeshLambertMaterial;
      line: THREE.LineBasicMaterial;
      shadow: THREE.MeshBasicMaterial;
      figure: THREE.MeshLambertMaterial;
    };
  } | null>(null);
  const turnRef = useRef(turn);
  useEffect(() => {
    turnRef.current = turn;
  }, [turn]);
  const walls = useMemo(() => spaceWalls(elements), [elements]);
  const roofs = useMemo(() => spaceRoofs(elements), [elements]);
  const rooms = useMemo(() => spaceRooms(elements), [elements]);

  // The renderer, once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    THREE.ColorManagement.enabled = false;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const scene = new THREE.Scene();
    const look = createLook(scene, renderer);
    const camera = new THREE.Camera();
    const mats = {
      solid: look.mats.solid,
      glass: look.mats.glass,
      line: new THREE.LineBasicMaterial({ color: OUTLINE, transparent: true, opacity: 0.3 }),
      shadow: new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
      figure: look.mats.figure,
    };
    const outline = createOutlinePass({
      k: DEPTH_K,
      perspective: SPACE_3D_PERSPECTIVE_PX,
      ink: OUTLINE,
    });
    engine.current = { renderer, scene, camera, mats, outline, look };
    return () => {
      outline.dispose();
      look.dispose();
      mats.line.dispose();
      mats.shadow.dispose();
      renderer.dispose();
      engine.current = null;
    };
  }, []);

  // The static scene: walls (each its own, to fade), roofs (each its own, to hide the one you stand under), pieces.
  const staticRef = useRef<{
    walls: Map<string, { group: THREE.Group; mats: THREE.Material[] }>;
    roofs: Map<string, THREE.Group>;
    /** Hides a piece in the pieces' one geometry (while its moment moves it) and returns what puts it back. */
    lift: (id: string) => () => void;
    byId: Map<string, Element>;
    boundsById: Map<string, PieceBounds>;
    dispose: () => void;
  } | null>(null);
  const selectionStore = useOptionalSelectionStore();
  /** Re-marks the selection when the static scene (and so the pieces' boxes) is rebuilt. */
  const markSelection = useRef<() => void>(() => {});
  useEffect(() => {
    const e = engine.current;
    const canvas = canvasRef.current;
    if (!e || !canvas) return;
    const tokens =
      canvas.parentElement?.querySelector('[data-space-walls]') ?? canvas.parentElement;
    const style = tokens ? getComputedStyle(tokens) : null;
    const palette: WallPalette = wallPalette((n) => style?.getPropertyValue(n) ?? '');
    const disposers: (() => void)[] = [];
    const root = new THREE.Group();
    const wallMap = new Map<string, { group: THREE.Group; mats: THREE.Material[] }>();
    for (const w of walls) {
      // Each wall its own materials, so a cut-away fades it alone.
      const mats = {
        solid: e.mats.solid.clone(),
        glass: e.mats.glass.clone(),
        line: e.mats.line.clone(),
      };
      const built = buildGroup(wallMesh(w, palette), mats);
      root.add(built.group);
      wallMap.set(w.id, { group: built.group, mats: [mats.solid, mats.glass, mats.line] });
      disposers.push(built.dispose, () => Object.values(mats).forEach((m) => m.dispose()));
    }
    const roofMap = new Map<string, THREE.Group>();
    for (const r of roofs) {
      const built = buildGroup(roofMesh(r, palette), e.mats);
      root.add(built.group);
      roofMap.set(r.id, built.group);
      disposers.push(built.dispose);
    }
    const piecesBuilt = piecesMesh(elements);
    const pieces = buildGroup(piecesBuilt, e.mats);
    root.add(pieces.group);
    disposers.push(pieces.dispose);
    // A press is traced from the screen into the scene through the camera this frame drew with.
    const near = new THREE.Vector3();
    const far = new THREE.Vector3();
    setReal3DPicker((clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const nx = ((clientX - r.left) / r.width) * 2 - 1;
      const ny = 1 - ((clientY - r.top) / r.height) * 2;
      near.set(nx, ny, -1).applyMatrix4(e.camera.projectionMatrixInverse);
      far.set(nx, ny, 1).applyMatrix4(e.camera.projectionMatrixInverse);
      const dir = { x: far.x - near.x, y: far.y - near.y, z: far.z - near.z };
      // From the camera's side: the end of the ray higher above the floor.
      const from = dir.z > 0 ? far : near;
      const sign = dir.z > 0 ? -1 : 1;
      const hit = pickPiece(
        piecesBuilt.bounds,
        { x: from.x, y: from.y, z: from.z },
        { x: dir.x * sign, y: dir.y * sign, z: dir.z * sign },
      );
      return hit;
    });
    disposers.push(() => setReal3DPicker(null));
    e.scene.add(root);
    const solidMesh = pieces.group.children.find(
      (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.material === e.mats.solid,
    );
    const lift = (id: string) => {
      const range = piecesBuilt.ranges.get(id);
      const attr = solidMesh?.geometry.getAttribute('position') as
        THREE.BufferAttribute | undefined;
      if (!range || !attr) return () => {};
      const arr = attr.array as Float32Array;
      const saved = arr.slice(range.from * 3, range.to * 3);
      arr.fill(0, range.from * 3, range.to * 3);
      attr.clearUpdateRanges();
      attr.addUpdateRange(range.from * 3, saved.length);
      attr.needsUpdate = true;
      return () => {
        arr.set(saved, range.from * 3);
        attr.clearUpdateRanges();
        attr.addUpdateRange(range.from * 3, saved.length);
        attr.needsUpdate = true;
      };
    };
    const byId = new Map(elements.map((el) => [el.id, el] as const));
    staticRef.current = {
      boundsById: new Map(piecesBuilt.bounds.map((b) => [b.id, b])),
      walls: wallMap,
      roofs: roofMap,
      lift,
      byId,
      dispose: () => {
        e.scene.remove(root);
        disposers.forEach((d) => d());
      },
    };
    markSelection.current();
    return () => {
      staticRef.current?.dispose();
      staticRef.current = null;
    };
  }, [elements, walls, roofs, paletteKey]);

  // The selection, marked in the scene while editing (3d-view.md "Editing in 3D").
  useEffect(() => {
    const e = engine.current;
    if (!e || !selectionStore) return undefined;
    const marks = new SelectionMarks();
    e.scene.add(marks.group);
    const mark = () => {
      const s = staticRef.current;
      const { selectedId, multiSelectedIds } = selectionStore.get();
      const picked: PieceBounds[] = [];
      if (s)
        for (const id of selectionIds(selectedId, multiSelectedIds)) {
          const b = s.boundsById.get(id);
          if (b) picked.push(b);
        }
      marks.set(picked);
    };
    markSelection.current = mark;
    mark();
    const unsubscribe = selectionStore.subscribe(mark);
    return () => {
      unsubscribe();
      markSelection.current = () => {};
      e.scene.remove(marks.group);
      marks.dispose();
    };
  }, [selectionStore]);

  // The frame loop: the camera from the stage, the characters from their walkers, the cut-away from your feet.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const main = canvas.parentElement;
    if (!main) return;
    const figures = new Map<Element | HTMLElement, Figure>();
    const kit = new CharacterKit();
    const fx = new MomentFx(engine.current!.scene, engine.current!.mats.solid);
    let selfFeet: { x: number; y: number } | null = null;
    // Each piece's moment seen so far, so a new one (its seq grew) starts its 3D answer.
    const seenSeq = new Map<string, number>();
    for (const [id, p] of latestMoments()) seenSeq.set(id, p.seq);
    const unsubscribe = subscribeMoments(() => {
      const s = staticRef.current;
      if (!s) return;
      for (const [id, p] of latestMoments()) {
        if ((seenSeq.get(id) ?? 0) >= p.seq) continue;
        seenSeq.set(id, p.seq);
        const el = s.byId.get(id);
        if (!el || el.type !== 'shape' || !hasMoment(el.shape)) continue;
        fx.start(el, el.shape, p.side, selfFeet, () => s.lift(id), performance.now());
      }
    });
    const shadowGeo = new THREE.CircleGeometry(1, 16);
    let raf = 0;
    let lastSize = '';
    let lastCut = '';
    let lastRoof: string | null = null;
    const head = new THREE.Vector3();
    const ndc = new THREE.Vector3();
    const eye = new THREE.Vector3();
    const hitAt = new THREE.Vector3();
    const ray = new THREE.Ray();
    let lastTime = performance.now();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const e = engine.current;
      if (!e) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const stage = main.querySelector<HTMLElement>('[data-space-stage]:not([data-space-overlay])');
      const world = stage?.querySelector<HTMLElement>('[data-canvas-content]');
      if (!stage || !world) return;
      const w = main.clientWidth;
      const h = main.clientHeight;
      const ratio = Math.min(MAX_RATIO, window.devicePixelRatio || 1);
      const sizeKey = `${w}x${h}x${ratio}`;
      if (sizeKey !== lastSize) {
        lastSize = sizeKey;
        e.renderer.setPixelRatio(ratio);
        e.renderer.setSize(w, h, false);
        e.outline.setSize(w * ratio, h * ratio);
      }
      const ws = getComputedStyle(world);
      const clip = clipMatrix(getComputedStyle(stage).transform, ws.transform, scaleZ(ws.scale), {
        width: w,
        height: h,
      });
      e.camera.projectionMatrix.fromArray(clip);
      e.camera.projectionMatrixInverse.copy(e.camera.projectionMatrix).invert();

      // Characters.
      const seen = new Set<HTMLElement>();
      let self: { x: number; y: number } | null = null;
      for (const el of main.querySelectorAll<HTMLElement>('[data-figure]')) {
        seen.add(el);
        const key = el.dataset.figure ?? '';
        const scale = Number(el.dataset.figureScale) || 1;
        const m = new DOMMatrix(getComputedStyle(el).transform);
        const feet = { x: m.m41 + FEET_X * scale, y: m.m42 + FEET_Y * scale };
        if (el.dataset.avatar === 'self') self = feet;
        let pose: WalkerPose;
        try {
          pose = JSON.parse(key) as WalkerPose;
        } catch {
          continue;
        }
        let fig = figures.get(el);
        if (!fig) {
          const group = new THREE.Group();
          const shadow = new THREE.Mesh(shadowGeo, e.mats.shadow);
          shadow.frustumCulled = false;
          shadow.renderOrder = 1;
          group.add(shadow);
          const rig = new CharacterRig(e.mats.figure);
          group.add(rig.root);
          e.scene.add(group);
          fig = { group, rig, shadow, yaw: YAW[pose.facing] ?? 0 };
          figures.set(el, fig);
        }
        const look = { ...(pose.config as CharacterLook | null), shirt: pose.shirt };
        const lk = lookKey(look);
        fig.rig.wear(lk, kit.geometries(lk, look));
        fig.rig.hold(pose.wave !== null ? 'flag' : pose.holding ? 'cup' : null);
        const unit = SPRITE_UNIT * scale;
        fig.rig.root.scale.setScalar(unit);
        fig.rig.pose(pose, dt, unit, now);
        // Turn the short way round toward its facing.
        const want = YAW[pose.facing] ?? 0;
        let d = want - fig.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        fig.yaw += d * Math.min(1, dt * 14);
        fig.rig.root.rotation.z = fig.yaw;
        fig.rig.root.position.z = Math.max(0, pose.lift || 0);
        fig.group.position.set(feet.x, feet.y, 0);
        // The sun casts each figure's shadow; the blob stays only as a faint contact shadow under the feet.
        const r = 5 * scale * (pose.seated ? 0 : 1);
        fig.shadow.visible = r > 0;
        fig.shadow.scale.set(r, r * 0.6, 1);
        fig.shadow.position.z = 0.4;
        fig.group.visible = el.getClientRects().length > 0;
      }
      for (const [el, fig] of figures)
        if (!seen.has(el as HTMLElement)) {
          e.scene.remove(fig.group);
          figures.delete(el);
        }

      // Editing has no character of yours: the floor at the middle of the view stands in for your feet, so the walls
      // in front of what you look at fade and the roofs over it lift (3d-view.md "Editing in 3D").
      let focus = self;
      if (!focus) {
        const r = main.getBoundingClientRect();
        focus = floorPointer(r.left + r.width / 2, r.top + r.height / 2) ?? null;
      }
      // The walls in front of you, and any in your way, fade; the roof over you, and any in your way, is lifted off.
      const s = staticRef.current;
      if (s) {
        const cut = new Set(cutAwayIds(walls, focus, turnRef.current, rooms));
        // A sight line from your head to the camera: whatever wall or roof it passes through is in your way.
        let reach = 0;
        if (focus) {
          head.set(focus.x, focus.y, 50);
          ndc.copy(head).applyMatrix4(e.camera.projectionMatrix);
          eye.set(ndc.x, ndc.y, -1).applyMatrix4(e.camera.projectionMatrixInverse);
          reach = eye.distanceTo(head);
          ray.set(head, eye.sub(head).normalize());
        }
        const inTheWay = (g: THREE.Object3D) => {
          if (!focus) return false;
          const box =
            (g.userData.box as THREE.Box3 | undefined) ?? new THREE.Box3().setFromObject(g);
          g.userData.box = box;
          const hit = ray.intersectBox(box, hitAt);
          return hit !== null && hit.distanceTo(head) < reach;
        };
        for (const [id, w] of s.walls) if (inTheWay(w.group)) cut.add(id);
        const cutKey = [...cut].sort().join(',');
        if (cutKey !== lastCut) {
          lastCut = cutKey;
          for (const [id, w] of s.walls) {
            const ghost = cut.has(id);
            w.mats.forEach((m, i) => {
              // [solid, glass, line]: each back to its own look, or a ghost that writes no depth (so it never hides
              // what stands behind it, nor draws ink round it).
              const base = BASE_LOOK[i]!;
              m.transparent = ghost || base.opacity < 1;
              m.opacity = ghost ? Math.min(base.opacity, SPACE_CUT_OPACITY) : base.opacity;
              m.depthWrite = !ghost && base.depthWrite;
              m.needsUpdate = true;
            });
          }
        }
        // The roof over you is lifted off, and so is any roof standing between the camera and you, so a turn never
        // leaves you behind a building.
        const hidden = new Set<string>();
        const over = roofOver(roofs, focus);
        if (over) hidden.add(over);
        for (const [id, g] of s.roofs) if (inTheWay(g)) hidden.add(id);
        const roofKey = [...hidden].sort().join(',');
        if (roofKey !== lastRoof) {
          lastRoof = roofKey;
          for (const [id, g] of s.roofs) g.visible = !hidden.has(id);
        }
      }
      // The sun follows the middle of the view (your feet when walking), so its shadows cover what you see.
      selfFeet = self;
      fx.update(now);
      const middle = focus ?? { x: 0, y: 0 };
      e.look.follow(middle.x, middle.y);
      e.outline.render(e.renderer, e.scene, e.camera);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      const e = engine.current;
      for (const fig of figures.values()) e?.scene.remove(fig.group);
      kit.dispose();
      unsubscribe();
      fx.dispose();
      shadowGeo.dispose();
    };
  }, [walls, roofs, rooms]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-real-3d-canvas=""
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
