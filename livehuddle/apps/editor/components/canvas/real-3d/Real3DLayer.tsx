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

import { applyOverlay, useDragPreview } from '@/lib/drag-preview';
import { deskScreens, type DeskScreens } from './desk-screens';
import { createIdleScreens, type IdleScreens } from './idle-screens';
import { idleScreen } from '@/lib/real-3d/idle-screen-logo';
import { posterEntries, usePosterPictures, type PosterPictureSource } from './usePosterPictures';
import { seatSurface } from '@/lib/real-3d/seat-surface';
import { placingDrawn, placingPiece, usePlacingPiece } from '@/lib/real-3d/placing-piece';
import { isWallPiece, mountsOnWall, pieceFacing } from '@livehuddle/document';
import { setModelFootprints } from '@livehuddle/avatar/office-geometry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { selectionMoving, useCanvasGesture } from '@liveworkspace/workbench/lib/canvas-gesture';
import * as THREE from 'three';
import type { Element } from '@livehuddle/document';
import { spaceWalls } from '@/lib/space-3d/space-3d-walls';
import { spaceRoofs, roofOver } from '@/lib/space-3d/space-3d-roofs';
import { acrossView, cutAwayIds, frontWallIds, spaceRooms } from '@/lib/space-3d/space-3d-cutaway';
import { space3DTiltNow } from '@/lib/space-3d/space-3d-preference';
import { wallHeldPieces } from '@/lib/real-3d/wall-held-pieces';
import { clipMatrix, DEPTH_K, scaleZ } from '@/lib/real-3d/projection';
import { SPACE_3D_PERSPECTIVE_PX } from '@/lib/space-3d/space-3d-camera';
import { createOutlinePass, type OutlinePass } from './outline-pass';
import { laterMaterials, ShaderWarmup } from './shader-warmup';
import { createLook, setEye, type Look } from './scene-look';
import { contactShadows } from './contact-shadows';
import { createDoorMotion, NO_DOOR_MOTION, type DoorMotion } from './door-motion';
import {
  wallMesh,
  roofMesh,
  wallPalette,
  WALL_CUT_HEIGHT,
  type WallPalette,
} from '@/lib/real-3d/scene-walls';
import {
  floorHeightAt,
  modelled,
  padTops,
  piecesMesh,
  type PadTop,
} from '@/lib/real-3d/scene-pieces';
import { AVATAR_PAD_HEIGHT } from '@/lib/real-3d/models/pad';
import { RISE, WALL_RISE } from '@/lib/real-3d/models/kit';
import { grassField, grassKey, onLawn } from '@/lib/real-3d/scene-grass';
import { grassMesh, type GrassMesh } from './grass-field';
import { RoadTraffic } from './road-traffic-mesh';
import { trafficRoads, type TrafficRoad } from '@/lib/real-3d/road-traffic';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { pickPiece } from '@/lib/real-3d/piece-pick';
import { floorPieceAt } from '@/lib/real-3d/floor-pick';
import {
  setReal3DModels,
  setReal3DPicker,
  setReal3DProjector,
  setReal3DWallAim,
} from '@/lib/real-3d/real-3d-pick';
import { wallHitAlong } from '@/lib/real-3d/wall-aim';
import type { MeshBuilder } from '@/lib/real-3d/mesh-builder';
import { lookKey, type CharacterLook } from '@/lib/real-3d/character';
import { CharacterKit, CharacterRig, type WalkerPose } from './character-rig';
import { FigureMotion } from '@/lib/real-3d/figure-motion';
import { FrameGovernor, startLevel, type DeviceHints } from '@/lib/real-3d/adaptive-quality';
import { MomentFx } from './moment-fx';
import { OfficeDogs } from './office-dog';
import { SelectionMarks } from './selection-marks';
import { floorPointer } from '@/lib/space-3d/floor-pointer';
import { useOptionalSelectionStore } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { selectionIds } from '@liveworkspace/workbench/lib/selection-store';
import type { PieceBounds, PiecesTriangles } from '@/lib/real-3d/piece-pick';
import { hasMoment, latestMoments, subscribeMoments } from '@/lib/piece-moments';
import { headRisePx, writeHeadRise } from '@/lib/real-3d/head-rise';

/** Screen px per drawn px: the scene is drawn at a quarter of the pixels and scaled up with hard edges. */
/** The scene draws at the screen's own resolution, so edges are as crisp as the flat drawings. */
const MAX_RATIO = 2;
/** The sprite's pixel, in canvas px at size 1 (walk.ts AVATAR_UNIT). */
const SPRITE_UNIT = 60 / 24;

/** Each sitter's last seat search, kept while nothing it depends on changes (the frame loop's seat lookup). */
const seatMemo = new WeakMap<
  object,
  {
    seats: object;
    x: number;
    y: number;
    yaw: number;
    scale: number;
    seat: ReturnType<typeof seatSurface>;
  }
>();

/** What the device says of itself, for the quality to start at. */
function deviceHints(renderer: THREE.WebGLRenderer | undefined): DeviceHints {
  let gpu: string | null = null;
  try {
    const gl = renderer?.getContext();
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && info) gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  } catch {
    gpu = null;
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    gpu,
    cores: nav.hardwareConcurrency,
    memoryGb: nav.deviceMemory,
    mobile: matchMedia('(pointer: coarse)').matches,
  };
}
/** How long after the last movement the scene counts as calm and drops to 30 frames a second. */
const CALM_AFTER_MS = 600;
/** The walker's box: where its feet are inside it, per unit of scale (walk.ts avatarBox). */
const FEET_X = 13 * SPRITE_UNIT;
const FEET_Y = 56 + 80;
const OUTLINE = 0x2b2438;
/** How long a lawn's change must settle before its blades regrow. */
const GRASS_SETTLE_MS = 250;
/** How long a wall takes to be cut down, or to grow back (3d-view.md "Walls in front of you are cut away"). */
/** Whether a piece goes into or onto a wall (a door, a window, a clock): placing it leaves the walls standing. */
function standsInWall(el: Element): boolean {
  if (el.type !== 'shape') return false;
  return mountsOnWall(el.shape) || isWallPiece(el);
}
const CUT_MS = 320;

/** The walls across the view at each quarter turn, worked out once per set of walls (not each frame). */
const acrossCache = new WeakMap<
  readonly { id: string; a: { x: number; y: number }; b: { x: number; y: number } }[],
  Set<string>[]
>();
function acrossFor(
  walls: readonly { id: string; a: { x: number; y: number }; b: { x: number; y: number } }[],
  turn: number,
): Set<string> {
  let byTurn = acrossCache.get(walls);
  if (!byTurn) {
    byTurn = [0, 1].map((t) => new Set(walls.filter((w) => acrossView(w, t)).map((w) => w.id)));
    acrossCache.set(walls, byTurn);
  }
  return byTurn[((turn % 2) + 2) % 2]!;
}

/**
 * Fades a wall (or its cut-down copy) to `opacity`: its meshes get materials of their own the first time it fades
 * (kept on the group, disposed with it by disposeFades), so a wall fades on its own, never every wall sharing its
 * colour. Opaque again at 1, writing depth as before.
 */
function fadeGroup(group: THREE.Group, opacity: number): void {
  let mats = group.userData.fadeMats as THREE.Material[] | undefined;
  if (!mats) {
    if (opacity >= 1) return;
    const own: THREE.Material[] = [];
    const made = new Map<THREE.Material, THREE.Material>();
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
      const m = o.material as THREE.Material;
      let c = made.get(m);
      if (!c) {
        c = m.clone();
        made.set(m, c);
        own.push(c);
      }
      o.material = c;
    });
    group.userData.fadeMats = mats = own;
  }
  for (const m of mats) {
    m.transparent = opacity < 1;
    m.opacity = opacity;
    m.depthWrite = opacity >= 1;
  }
}

/** Disposes the materials fadeGroup gave a wall. */
function disposeFades(group: THREE.Group): void {
  for (const m of (group.userData.fadeMats as THREE.Material[] | undefined) ?? []) m.dispose();
}
/** Higher than this (canvas px, risen), a surface over a sitter is a chair's back or a desk, never their seat. */
const SEAT_CAP = 70;
/** How long a cut-down wall waits, out of your way, before it grows back (so a pan past it never flickers it). */
const REGROW_DELAY_MS = 450;
/** How long a roof takes to lift off and fade, or to settle back. */
const ROOF_MS = 380;
/** How high a roof rises as it lifts off. */
const ROOF_LIFT = 60;

type StaticScene = {
  /** Each wall standing, and cut down: `cut` goes 0 (standing) to 1 (cut down) as it slides. */
  walls: Map<
    string,
    {
      group: THREE.Group;
      low: THREE.Group;
      height: number;
      cut: number;
      want: number;
      /** When it last was in your way (ms), for the wait before it grows back. */
      seen: number;
    }
  >;
  /** Each roof: `lift` goes 0 (on) to 1 (lifted off and gone) as it eases, its own materials faded with it. */
  roofs: Map<string, { group: THREE.Group; lift: number; mats: THREE.Material[] }>;
};

type Props = {
  elements: readonly Element[];
  /** The tab shown, whose drag previews (ours and collaborators') the scene draws as they happen. */
  tabId: string;
  /** The camera's quarter turns, for the walls cut away in front of you. */
  turn: number;
  /** A changing value whenever the palette's tokens may have changed (theme, wall colour). */
  paletteKey: string;
  /** Whose pictures the Posters read (docs/specs/009-elements/poster.md); absent, they hang empty. */
  pictureSource?: PosterPictureSource;
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
  /** How it really moves: its heading, speed and turn, from where its feet are each frame. */
  motion: FigureMotion;
  /** The head rise last written for its chips (head-rise.ts). */
  chip: { rise: number | null };
};

export default function Real3DLayer({
  elements: board,
  tabId,
  turn,
  paletteKey,
  pictureSource,
}: Props) {
  // A drag draws where the pieces are going as it goes (drag-preview.ts), not only once it lands (the owner,
  // 2026-11-27: "I don't see where I am dragging them to").
  const preview = useDragPreview(tabId, board);
  const elements = useMemo(
    () => (preview ? applyOverlay(board, preview) : board),
    [board, preview],
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engine = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    outline: OutlinePass;
    look: Look;
    /** Holds a frame while the programs it needs compile off the main thread (shader-warmup.ts). */
    warmup: ShaderWarmup;
    /** Stand-ins for the materials the scene makes later, compiled with its first frame (shader-warmup.ts). */
    later: THREE.Group;
    mats: {
      solid: THREE.MeshLambertMaterial;
      glass: THREE.MeshLambertMaterial;
      line: THREE.LineBasicMaterial;
      shadow: THREE.MeshBasicMaterial;
      figure: THREE.MeshLambertMaterial;
    };
  } | null>(null);
  const turnRef = useRef(turn);
  // While 3D draws, a turned piece blocks where its model stands (the owner walked into a bookcase on its side).
  useEffect(() => {
    setModelFootprints(pieceFacing);
    return () => setModelFootprints(null);
  }, []);
  useEffect(() => {
    turnRef.current = turn;
  }, [turn]);
  // Lawns grow real blades (grass-field.ts) in place of the stood-up rows of the old view.
  // Walls, roofs and rooms kept by their content, so a board change that moves no wall (a piece dragged, a note
  // typed) keeps the same ones and rebuilds none of them.
  const wallsKey = useMemo(
    () => JSON.stringify(spaceWalls(elements).filter((w) => w.kind !== 'grass')),
    [elements],
  );
  const walls = useMemo(() => JSON.parse(wallsKey) as ReturnType<typeof spaceWalls>, [wallsKey]);
  // The blades take the lawn's colour as the floor draws it on this paper (light or dark), so they regrow with it.
  const surface = useCanvasSurface();
  // The latest board and paper, for effects that run on their own keys (the grass, a press's floor piece).
  const elementsRef = useRef(elements);
  const surfaceRef = useRef(surface);
  useEffect(() => {
    elementsRef.current = elements;
    surfaceRef.current = surface;
  }, [elements, surface]);
  // The roads the cars drive on (docs/specs/009-elements/road.md "Traffic"), read by the frame loop.
  const roads = useMemo(() => trafficRoads(elements), [elements]);
  const roadsRef = useRef<readonly TrafficRoad[]>(roads);
  useEffect(() => {
    roadsRef.current = roads;
  }, [roads]);
  const lawnKey = useMemo(() => `${surface}|${grassKey(elements)}`, [elements, surface]);
  const roofsKey = useMemo(() => JSON.stringify(spaceRoofs(elements)), [elements]);
  const roofs = useMemo(() => JSON.parse(roofsKey) as ReturnType<typeof spaceRoofs>, [roofsKey]);
  const roomsKey = useMemo(() => JSON.stringify(spaceRooms(elements)), [elements]);
  const rooms = useMemo(() => JSON.parse(roomsKey) as ReturnType<typeof spaceRooms>, [roomsKey]);

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
    const warmup = new ShaderWarmup(renderer);
    const later = laterMaterials();
    engine.current = { renderer, scene, camera, mats, outline, look, warmup, later: later.group };
    return () => {
      later.dispose();
      outline.dispose();
      look.dispose();
      mats.line.dispose();
      mats.shadow.dispose();
      renderer.dispose();
      engine.current = null;
    };
  }, []);

  // The Posters' pictures, quads of their own over their frames (poster-pictures.ts).
  const posters = usePosterPictures(() => engine.current?.scene ?? null, pictureSource);
  // Idle Screens' logo, one mesh on one shared texture (idle-screens.ts).
  const idleRef = useRef<IdleScreens | null>(null);
  const idlePlaces = useRef<ReadonlyMap<string, readonly number[]>>(new Map());
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const made = createIdleScreens();
    e.scene.add(made.object);
    made.set(idlePlaces.current);
    idleRef.current = made;
    return () => {
      e.scene.remove(made.object);
      made.dispose();
      if (idleRef.current === made) idleRef.current = null;
    };
  }, []);

  // The static scene: walls (each its own, to cut down), roofs (each its own, to hide the one you stand under), pieces.
  const staticRef = useRef<{
    walls: StaticScene['walls'];
    roofs: StaticScene['roofs'];
    /** Hides a piece in the pieces' one geometry (while its moment moves it) and returns what puts it back. */
    lift: (id: string) => () => void;
    byId: Map<string, Element>;
    boundsById: Map<string, PieceBounds>;
    /** The Avatar Pads' tops, which a character on one stands on. */
    pads: PadTop[];
    /** The doors in the doorways, opening as characters come (door-motion.ts). */
    doors: DoorMotion;
  }>({
    pads: [],
    doors: NO_DOOR_MOTION,
    walls: new Map(),
    roofs: new Map(),
    lift: () => () => {},
    byId: new Map(),
    boundsById: new Map(),
  });
  const screensRef = useRef<DeskScreens | null>(null);
  // The pieces hung on each wall, which go with it when it is cut down (wall-held-pieces.ts), and those hidden now
  // with what puts each back.
  const heldOnWalls = useMemo(() => wallHeldPieces(walls, elements), [walls, elements]);
  const heldRef = useRef(heldOnWalls);
  const hiddenHeld = useRef(new Map<string, () => void>());
  useEffect(() => {
    heldRef.current = heldOnWalls;
  }, [heldOnWalls]);
  /** The pieces' geometry, for the seat under a sitter (seat-surface.ts). */
  const seatsRef = useRef<{
    mesh: PiecesTriangles;
    bounds: readonly PieceBounds[];
    kinds: ReadonlyMap<string, string>;
  } | null>(null);
  const selectionStore = useOptionalSelectionStore();
  /** Re-marks the selection when the pieces (and so their boxes) are rebuilt. */
  const markSelection = useRef<() => void>(() => {});
  // The walls and roofs: rebuilt only when they change, not on every board change (each wall clones its materials).
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
    const wallMap: StaticScene['walls'] = new Map();
    for (const w of walls) {
      // Each wall standing, and cut down (shown in its place while you stand in front of it).
      const built = buildGroup(wallMesh(w, palette).rise(WALL_RISE), e.mats);
      const low = buildGroup(wallMesh(w, palette, WALL_CUT_HEIGHT).rise(WALL_RISE), e.mats);
      low.group.visible = false;
      root.add(built.group, low.group);
      wallMap.set(w.id, {
        group: built.group,
        low: low.group,
        height: w.height,
        cut: 0,
        want: 0,
        seen: 0,
      });
      disposers.push(built.dispose, low.dispose, () => {
        disposeFades(built.group);
        disposeFades(low.group);
      });
    }
    const doorMotion = createDoorMotion(
      walls,
      palette,
      (b) => buildGroup(b, e.mats),
      (id) => {
        const w = wallMap.get(id);
        return w && [w.group, w.low];
      },
    );
    disposers.push(doorMotion.dispose);
    const roofMap: StaticScene['roofs'] = new Map();
    for (const r of roofs) {
      const built = buildGroup(roofMesh(r, palette).rise(WALL_RISE), e.mats);
      // Its own materials (a roof is a handful of meshes), so it fades on its own as it lifts off.
      const mats: THREE.Material[] = [];
      built.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
        const m = (o.material as THREE.Material).clone();
        o.material = m;
        mats.push(m);
      });
      root.add(built.group);
      roofMap.set(r.id, { group: built.group, lift: 0, mats });
      disposers.push(built.dispose, () => mats.forEach((m) => m.dispose()));
    }
    e.scene.add(root);
    const st = staticRef.current;
    st.walls = wallMap;
    st.roofs = roofMap;
    st.doors = doorMotion;
    return () => {
      e.scene.remove(root);
      disposers.forEach((d) => d());
      st.walls = new Map();
      st.roofs = new Map();
      st.doors = NO_DOOR_MOTION;
    };
  }, [walls, roofs, paletteKey]);
  // A wall piece aims at the wall the pointer is over, not the floor behind it (wall-aim.ts): the sight line through a
  // floor point, from the camera this frame drew with, against the walls as they stand now (a cut one is low).
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const ndc = new THREE.Vector3();
    const near = new THREE.Vector3();
    const far = new THREE.Vector3();
    const low = {
      has: (id: string) => (staticRef.current?.walls.get(id)?.cut ?? 0) >= 0.5,
    };
    setReal3DWallAim(({ x, y }) => {
      ndc.set(x, y, 0).applyMatrix4(e.camera.projectionMatrix);
      if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return null;
      near.set(ndc.x, ndc.y, -1).applyMatrix4(e.camera.projectionMatrixInverse);
      far.set(ndc.x, ndc.y, 1).applyMatrix4(e.camera.projectionMatrixInverse);
      // From the camera's side (the end higher above the floor), into the scene.
      const [from, to] = far.z > near.z ? [far, near] : [near, far];
      const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
      return wallHitAlong(walls, low, { x: from.x, y: from.y, z: from.z }, dir);
    });
    return () => setReal3DWallAim(null);
  }, [walls]);
  // While a selection is dragged, resized or reshaped the pieces' one geometry stays as the gesture found it: the
  // pieces the gesture changes are lifted out of it and drawn on their own each tick (below), so a tick costs those
  // pieces, not the whole scene. It is rebuilt once when the gesture ends.
  const moving = selectionMoving(useCanvasGesture());
  const [frozen, setFrozen] = useState<readonly Element[] | null>(null);
  if (moving && !frozen) setFrozen(board);
  if (!moving && frozen) setFrozen(null);
  const pieceBase = moving ? (frozen ?? elements) : elements;
  // The pieces: one geometry, each piece's model kept between changes (scene-pieces.ts).
  useEffect(() => {
    const elements = pieceBase;
    const e = engine.current;
    const canvas = canvasRef.current;
    if (!e || !canvas) return;
    const disposers: (() => void)[] = [];
    const piecesBuilt = piecesMesh(elements);
    const pieces = buildGroup(piecesBuilt, e.mats);
    e.scene.add(pieces.group);
    disposers.push(() => e.scene.remove(pieces.group), pieces.dispose);
    // Each piece sits in a soft contact shadow (contact-shadows.ts).
    const kinds = new Map(
      elements.flatMap((el) => (el.type === 'shape' ? [[el.id, el.shape] as const] : [])),
    );
    const grounding = contactShadows(
      piecesBuilt.bounds,
      (x, y) => onLawn(elements, x, y),
      (id) => kinds.get(id),
    );
    e.scene.add(grounding.object);
    disposers.push(() => e.scene.remove(grounding.object), grounding.dispose);
    // Desk screens light while someone sits at them (desk-screens.ts).
    const lit = deskScreens(piecesBuilt.screens, piecesBuilt.positions, piecesBuilt.bounds);
    e.scene.add(lit.object);
    screensRef.current = lit;
    seatsRef.current = { mesh: piecesBuilt, bounds: piecesBuilt.bounds, kinds };
    disposers.push(() => {
      e.scene.remove(lit.object);
      lit.dispose();
      if (screensRef.current === lit) screensRef.current = null;
    });
    // A press is traced from the screen into the scene through the camera this frame drew with.
    const near = new THREE.Vector3();
    const far = new THREE.Vector3();
    const projected = new THREE.Vector3();
    setReal3DProjector((x, y, z) => {
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const p = projected.set(x, y, z).applyMatrix4(e.camera.projectionMatrix);
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
    });
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
        piecesBuilt,
      );
      if (hit) return hit;
      // No model met: a press on a Room's or a Corridor's floor picks it (floor-pick.ts).
      const dz = dir.z * sign;
      if (Math.abs(dz) < 1e-9) return null;
      const t = -from.z / dz;
      if (t < 0) return null;
      const point = { x: from.x + dir.x * sign * t, y: from.y + dir.y * sign * t };
      // Else the floor under it, through the very camera the scene drew with (the stage's own guess drifted from it).
      return { id: floorPieceAt(elementsRef.current, point), point };
    });
    disposers.push(
      () => setReal3DPicker(null),
      () => setReal3DProjector(null),
    );
    setReal3DModels(new Map(piecesBuilt.bounds.map((b) => [b.id, b])));
    disposers.push(() => setReal3DModels(new Map()));
    const meshOf = (mat: THREE.Material) =>
      pieces.group.children.find(
        (o): o is THREE.Mesh | THREE.LineSegments =>
          (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) && o.material === mat,
      );
    const solidMesh = meshOf(e.mats.solid);
    const glassMesh = meshOf(e.mats.glass);
    const lineMesh = meshOf(e.mats.line);
    // Collapses floats [from, to) of a mesh's positions to nothing, and returns what puts them back.
    const collapse = (mesh: THREE.Object3D | undefined, from: number, to: number) => {
      const attr = (mesh as THREE.Mesh | undefined)?.geometry.getAttribute('position') as
        THREE.BufferAttribute | undefined;
      if (!attr || to <= from) return () => {};
      const arr = attr.array as Float32Array;
      const saved = arr.slice(from, to);
      const write = (fill: Float32Array | null) => {
        if (fill) arr.set(fill, from);
        else arr.fill(0, from, to);
        attr.clearUpdateRanges();
        attr.addUpdateRange(from, to - from);
        attr.needsUpdate = true;
      };
      write(null);
      return () => write(saved);
    };
    const lift = (id: string) => {
      const range = piecesBuilt.ranges.get(id);
      const span = piecesBuilt.spans.get(id);
      if (!range) return () => {};
      const back = [
        grounding.hide(id),
        collapse(solidMesh, range.from * 3, range.to * 3),
        collapse(glassMesh, span?.glass[0] ?? 0, span?.glass[1] ?? 0),
        collapse(lineMesh, span?.lines[0] ?? 0, span?.lines[1] ?? 0),
      ];
      return () => back.forEach((f) => f());
    };
    // A new geometry shows every piece: the cut-away pass hides the hung ones again on its next frame.
    hiddenHeld.current = new Map();
    const st = staticRef.current;
    st.boundsById = new Map(piecesBuilt.bounds.map((b) => [b.id, b]));
    st.lift = lift;
    st.byId = new Map(elements.map((el) => [el.id, el] as const));
    posters.set(posterEntries(piecesBuilt.posterPictures, st.byId));
    const idle = new Map<string, readonly number[]>();
    for (const [id, corners] of piecesBuilt.screenFaces)
      if (idleScreen(st.byId.get(id))) idle.set(id, corners);
    idlePlaces.current = idle;
    idleRef.current?.set(idle);
    st.pads = padTops(elements);
    markSelection.current();
    return () => {
      disposers.forEach((d) => d());
      st.boundsById = new Map();
      st.lift = () => () => {};
    };
  }, [pieceBase, paletteKey, posters]);

  // The pieces a gesture is changing, drawn on their own over the frozen geometry they are lifted out of.
  const liftedRef = useRef(new Map<string, () => void>());
  useEffect(() => {
    const e = engine.current;
    if (!e || !frozen) return;
    const before = new Map(frozen.map((el) => [el.id, el] as const));
    const changed = elements.filter((el) => before.get(el.id) !== el && modelled(el));
    if (!changed.length) return;
    const st = staticRef.current;
    for (const el of changed)
      if (!liftedRef.current.has(el.id)) liftedRef.current.set(el.id, st.lift(el.id));
    const built = piecesMesh(changed);
    const group = buildGroup(built, e.mats);
    // Their contact shadows go with them (the frozen ones are hidden as each is lifted).
    const kinds = new Map(
      changed.map((el) => [el.id, el.type === 'shape' ? el.shape : ''] as const),
    );
    const grounding = contactShadows(
      built.bounds,
      (x, y) => onLawn(elements, x, y),
      (id) => kinds.get(id),
    );
    group.group.add(grounding.object);
    e.scene.add(group.group);
    // A Poster's picture rides with its frame.
    posters.move(built.posterPictures);
    idleRef.current?.move(built.screenFaces);
    const saved = new Map<string, PieceBounds | undefined>();
    for (const b of built.bounds) {
      saved.set(b.id, st.boundsById.get(b.id));
      st.boundsById.set(b.id, b);
    }
    markSelection.current();
    return () => {
      e.scene.remove(group.group);
      group.dispose();
      grounding.dispose();
      for (const [id, b] of saved) if (b) st.boundsById.set(id, b);
      posters.restore(built.posterPictures.keys());
      const back = new Map<string, readonly number[]>();
      for (const id of built.screenFaces.keys()) {
        const c = idlePlaces.current.get(id);
        if (c) back.set(id, c);
      }
      idleRef.current?.move(back);
    };
  }, [elements, frozen, posters]);
  // Clocks tick once a minute (social-pieces.md "Clock"), at the viewer's own time: at each minute their models alone are built
  // again over the frozen ones, so their hands move without rebuilding the board. Nothing runs between minutes.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const clocks = elements.filter((el) => el.type === 'shape' && el.shape === 'world-clock');
    if (!clocks.length) return;
    const st = staticRef.current;
    let drawn: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      drawn?.();
      const restore = clocks.map((el) => st.lift(el.id));
      const group = buildGroup(piecesMesh(clocks, elements), e.mats);
      e.scene.add(group.group);
      drawn = () => {
        e.scene.remove(group.group);
        group.dispose();
        restore.forEach((f) => f());
      };
    };
    const next = () => {
      timer = setTimeout(
        () => {
          draw();
          next();
        },
        60_000 - (Date.now() % 60_000) + 20,
      );
    };
    next();
    return () => {
      clearTimeout(timer);
      drawn?.();
    };
  }, [elements, pieceBase, paletteKey]);
  // The piece being placed from the palette, drawn where it would land as it will stand once dropped (3d-view.md
  // "Editing in 3D"): its model and its contact shadow, built on their own, so a pointer move costs that one piece.
  const placing = usePlacingPiece();
  useEffect(() => {
    const e = engine.current;
    if (!e || !placing || !modelled(placing)) {
      placingDrawn.set(false);
      return;
    }
    const built = piecesMesh([placing]);
    const group = buildGroup(built, e.mats);
    const kind = placing.shape;
    const grounding = contactShadows(
      built.bounds,
      (x, y) => onLawn(elements, x, y),
      () => kind,
    );
    group.group.add(grounding.object);
    e.scene.add(group.group);
    placingDrawn.set(true);
    return () => {
      e.scene.remove(group.group);
      group.dispose();
      grounding.dispose();
    };
  }, [placing, elements]);
  // A door, a window or a fence being placed is part of the walls: the walls it changes are drawn as they will
  // stand with it (the doorway cut, the window glazed, the fence run), in place of the ones standing now, so you see
  // exactly where it lands (the owner, 2026-11-27).
  useEffect(() => {
    const e = engine.current;
    const st = staticRef.current;
    if (!e || !placing || modelled(placing)) return;
    const now = new Set(walls.map((w) => JSON.stringify(w)));
    const next = spaceWalls([...elements, placing]).filter((w) => w.kind !== 'grass');
    const nextKeys = new Set(next.map((w) => JSON.stringify(w)));
    const added = next.filter((w) => !now.has(JSON.stringify(w)));
    if (added.length === 0) return;
    const gone = walls.filter((w) => !nextKeys.has(JSON.stringify(w)));
    const tokens =
      canvasRef.current?.parentElement?.querySelector('[data-space-walls]') ??
      canvasRef.current?.parentElement;
    const style = tokens ? getComputedStyle(tokens) : null;
    const palette: WallPalette = wallPalette((n) => style?.getPropertyValue(n) ?? '');
    const root = new THREE.Group();
    const built = added.map((w) => buildGroup(wallMesh(w, palette).rise(WALL_RISE), e.mats));
    for (const b of built) root.add(b.group);
    const hidden: THREE.Group[] = [];
    for (const w of gone) {
      const was = st.walls.get(w.id);
      if (!was) continue;
      for (const g of [was.group, was.low]) {
        if (!g.visible) continue;
        g.visible = false;
        hidden.push(g);
      }
      // Kept out of sight while the new one stands in for it (the cut-away pass would show it again).
      was.group.userData.placingHidden = true;
    }
    e.scene.add(root);
    placingDrawn.set(true);
    return () => {
      e.scene.remove(root);
      built.forEach((b) => b.dispose());
      for (const w of gone) {
        const was = st.walls.get(w.id);
        if (was) delete was.group.userData.placingHidden;
      }
      for (const g of hidden) g.visible = true;
      placingDrawn.set(false);
    };
  }, [placing, elements, walls]);
  useEffect(() => () => placingDrawn.set(false), []);
  // The gesture over: what was lifted goes back (the geometry is rebuilt from the board as it now is).
  useEffect(() => {
    if (frozen) return;
    for (const back of liftedRef.current.values()) back();
    liftedRef.current.clear();
  }, [frozen]);

  // The lawns' blades, regrown only when a lawn or what covers it changes: at once the first time, then once a change
  // settles (growing a big lawn takes tens of ms; a lawn being dragged keeps its old blades until it is let go).
  const grassRef = useRef<GrassMesh | null>(null);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const grow = () => {
      const next = grassMesh(grassField(elementsRef.current, surfaceRef.current));
      const old = grassRef.current;
      if (old) {
        e.scene.remove(old.object);
        old.dispose();
      }
      grassRef.current = next;
      if (next) e.scene.add(next.object);
    };
    if (!grassRef.current) {
      grow();
      return;
    }
    const t = window.setTimeout(grow, GRASS_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [lawnKey]);
  useEffect(
    () => () => {
      const e = engine.current;
      const g = grassRef.current;
      if (g) {
        e?.scene.remove(g.object);
        g.dispose();
      }
      grassRef.current = null;
    },
    [],
  );

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
    // Each Pet Bed's dog, read from its hidden drawing (office-dog.ts).
    const dogs = new OfficeDogs(engine.current!.scene, main);
    // The Roads' cars: built the first time the board has a road, then kept (road-traffic-mesh.ts).
    let traffic: RoadTraffic | null = null;
    let carsShown = -1;
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
    const head = new THREE.Vector3();
    const ndc = new THREE.Vector3();
    const eye = new THREE.Vector3();
    const hitAt = new THREE.Vector3();
    const ray = new THREE.Ray();
    let lastTime = performance.now();
    // Frame pacing (3d-engine.md "Performance"): never more than 60 frames a second, however fast the screen, and
    // 30 once the scene is calm (nobody moving, the camera still, nothing easing, no pointer), so the idle breathing,
    // grass and pets keep going at half the cost. Anything moving brings 60 back for a moment.
    let busyUntil = 0;
    let wasBusy = false;
    let lastClip = '';
    let shown = false;
    // What each frame draws: the scene, then the ink pass's screen quad.
    const passes = [
      { scene: engine.current!.scene, camera: engine.current!.camera },
      { scene: engine.current!.outline.quad.scene, camera: engine.current!.outline.quad.camera },
    ];
    // How sharp to draw, for this device and kept by its own frame rate (adaptive-quality.ts).
    const governor = new FrameGovernor(startLevel(deviceHints(engine.current?.renderer)));
    const stir = () => {
      busyUntil = performance.now() + CALM_AFTER_MS;
    };
    main.addEventListener('pointermove', stir, { passive: true });
    main.addEventListener('pointerdown', stir, { passive: true });
    main.addEventListener('wheel', stir, { passive: true });
    window.addEventListener('keydown', stir);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const e = engine.current;
      if (!e) return;
      const now = performance.now();
      const busy = now < busyUntil;
      const gap = busy ? 1000 / 60 : 1000 / 30;
      // A little early is fine: a screen's frames never land exactly on the gap.
      if (now - lastTime < gap - 3) return;
      // Only frames paced at 60 judge the device: a calm frame is slow on purpose.
      if (busy && wasBusy) governor.frame(now - lastTime);
      wasBusy = busy;
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const stage = main.querySelector<HTMLElement>('[data-space-stage]:not([data-space-overlay])');
      const world = stage?.querySelector<HTMLElement>('[data-canvas-content]');
      if (!stage || !world) return;
      const w = main.clientWidth;
      const h = main.clientHeight;
      const ratio = Math.min(MAX_RATIO, governor.ratio, window.devicePixelRatio || 1);
      const sizeKey = `${w}x${h}x${ratio}`;
      if (sizeKey !== lastSize) {
        lastSize = sizeKey;
        e.renderer.setPixelRatio(ratio);
        e.renderer.domElement.dataset.quality = String(ratio);
        e.renderer.setSize(w, h, false);
        e.outline.setSize(w * ratio, h * ratio);
      }
      const ws = getComputedStyle(world);
      const clip = clipMatrix(getComputedStyle(stage).transform, ws.transform, scaleZ(ws.scale), {
        width: w,
        height: h,
      });
      const clipKey = Array.from(clip, (v) => v.toFixed(5)).join(',');
      if (clipKey !== lastClip) {
        lastClip = clipKey;
        stir();
      }
      e.camera.projectionMatrix.fromArray(clip);
      // The canvas's zoom (its world's scale), which the overlay's cards are drawn at.
      const zoomAt = new DOMMatrix(ws.transform === 'none' ? undefined : ws.transform);
      const zoom = Math.hypot(zoomAt.a, zoomAt.b) || 1;
      e.camera.projectionMatrixInverse.copy(e.camera.projectionMatrix).invert();
      setEye(e.camera.projectionMatrixInverse);

      // Characters.
      const seen = new Set<HTMLElement>();
      let self: { x: number; y: number } | null = null;
      const seatedFeet: { x: number; y: number }[] = [];
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
          fig = { group, rig, shadow, motion: new FigureMotion(pose.facing), chip: { rise: null } };
          figures.set(el, fig);
        }
        const look = { ...(pose.config as CharacterLook | null), shirt: pose.shirt };
        const lk = lookKey(look);
        fig.rig.wear(lk, kit.geometries(lk, look), look);
        const drink = typeof pose.holding === 'string' ? pose.holding : null;
        fig.rig.hold(drink ? 'cup' : null, drink);
        const unit = SPRITE_UNIT * scale;
        fig.rig.root.scale.setScalar(unit);
        // It faces the way it really moves, and strides at that speed (figure-motion.ts).
        fig.motion.update(feet, dt, pose.facing, pose.seated, scale);
        if (pose.seated) seatedFeet.push(feet);
        // A sitter rests on their seat's own top (a stool's, a sofa's), or lies along a hammock.
        const seats = seatsRef.current;
        // Found once per seat and kept while the sitter stays put (about 0.3 ms a search on a 140k-triangle tab,
        // measured 2026-11-27): it changes only when the pieces, the spot, the way they face or their size does.
        let seat: ReturnType<typeof seatSurface> = null;
        if (pose.seated && seats) {
          const memo = seatMemo.get(fig);
          const yaw = fig.motion.yaw;
          if (
            memo &&
            memo.seats === seats &&
            memo.x === feet.x &&
            memo.y === feet.y &&
            memo.scale === scale &&
            Math.abs(memo.yaw - yaw) < 1e-3
          )
            seat = memo.seat;
          else {
            seat = seatSurface(
              seats.mesh,
              seats.bounds,
              (id) => seats.kinds.get(id),
              feet,
              yaw,
              scale,
              SEAT_CAP,
            );
            seatMemo.set(fig, { seats, x: feet.x, y: feet.y, yaw, scale, seat });
          }
        }
        fig.rig.pose(
          pose,
          dt,
          unit,
          now,
          { speed: fig.motion.speed / unit, turn: fig.motion.turn },
          seat,
        );
        // Lying in a hammock: along its length, centred in its sling, head toward its frame's -x end.
        const bed = seat?.lying ? seat.bed : null;
        fig.rig.root.rotation.z = bed ? bed.yaw - Math.PI / 2 : fig.motion.yaw;
        fig.rig.root.position.z = Math.max(0, pose.lift || 0);
        // On an Avatar Pad it stands on the platform's top (models/pad.ts).
        const ground = floorHeightAt(
          staticRef.current.pads,
          feet.x,
          feet.y,
          AVATAR_PAD_HEIGHT * RISE,
        );
        if (bed) fig.group.position.set(bed.x, bed.y, 0);
        else fig.group.position.set(feet.x, feet.y, ground);
        // The sun casts each figure's shadow; the blob stays only as a faint contact shadow under the feet.
        const r = 5 * scale * (pose.seated ? 0 : 1);
        fig.shadow.visible = r > 0;
        fig.shadow.scale.set(r, r * 0.6, 1);
        fig.shadow.position.z = 0.4;
        if (fig.motion.speed > 1) stir();
        fig.group.visible = el.getClientRects().length > 0;
        // The chip over the head clears the head the scene drew (3d-engine.md "Chips over heads"): standing only, as a
        // sitter's chip keeps its own place over the seat.
        const reach = !pose.seated && !bed && fig.group.visible ? fig.rig.headReach() : null;
        let rise: number | null = null;
        if (reach !== null) {
          // The stand is the box's first child (AvatarWalker): no search per figure per frame.
          const card = el.firstElementChild instanceof HTMLElement ? el.firstElementChild : null;
          const flat = parseFloat(card?.style.getPropertyValue('--space-flat-scale') ?? '') || 1;
          rise = headRisePx(e.camera.projectionMatrix, feet, ground, reach * unit, h, zoom * flat);
        }
        const chipBox = el.nextElementSibling;
        writeHeadRise(
          chipBox instanceof HTMLElement && chipBox.hasAttribute('data-avatar-chip')
            ? [el, chipBox]
            : [el],
          rise,
          fig.chip,
        );
      }
      for (const [el, fig] of figures)
        if (!seen.has(el as HTMLElement)) {
          e.scene.remove(fig.group);
          fig.rig.dispose();
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
        // As deep as each wall hides the floor at the camera's tilt now (a right-drag tilts it).
        const tilt = space3DTiltNow() || undefined;
        const cut = new Set(cutAwayIds(walls, focus, turnRef.current, rooms, tilt));
        // Editing, every room's camera-side walls are down, so the whole floor plan is in reach, as every roof is off
        // (3d-view.md "Editing in 3D"; the owner, 2026-11-27: the tall front walls hid the front half of rooms).
        if (!self) for (const id of frontWallIds(walls, rooms, turnRef.current)) cut.add(id);
        // A piece being placed off the walls cuts down the walls in front of it, so you see where it lands (the
        // owner, 2026-11-27); one going onto a wall leaves it standing.
        const placingNow: Element | null = placingPiece.get();
        if (placingNow?.type === 'shape' && !standsInWall(placingNow)) {
          const at = {
            x: placingNow.x + placingNow.width / 2,
            y: placingNow.y + placingNow.height / 2,
          };
          for (const id of cutAwayIds(walls, at, turnRef.current, rooms, tilt)) cut.add(id);
        }
        // A sight line from your head to the camera: whatever wall or roof it passes through is in your way.
        let reach = 0;
        if (focus) {
          head.set(focus.x, focus.y, 50);
          ndc.copy(head).applyMatrix4(e.camera.projectionMatrix);
          eye.set(ndc.x, ndc.y, -1).applyMatrix4(e.camera.projectionMatrixInverse);
          reach = eye.distanceTo(head);
          ray.set(head, eye.sub(head).normalize());
        }
        // Only a wall across the view can hide you (acrossView); a side wall beside you never fades.
        const acrossIds = acrossFor(walls, turnRef.current);
        const inTheWay = (g: THREE.Object3D) => {
          if (!focus) return false;
          const box =
            (g.userData.box as THREE.Box3 | undefined) ?? new THREE.Box3().setFromObject(g);
          g.userData.box = box;
          const hit = ray.intersectBox(box, hitAt);
          return hit !== null && hit.distanceTo(head) < reach;
        };
        for (const [id, w] of s.walls) if (acrossIds.has(id) && inTheWay(w.group)) cut.add(id);
        const nowMs = now;
        // A wall in front of you fades out as its low cut-down copy fades in (its windows and doors cut cleanly), and
        // fades back as you leave: never squashed (the owner, 2026-11-27: "a simple fade would be less jarring").
        const step = Math.min(1, (dt * 1000) / CUT_MS);
        for (const [id, w] of s.walls) {
          // Down at once when it is in your way; back up only once it has been out of your way a moment.
          if (cut.has(id)) w.seen = nowMs;
          w.want = cut.has(id) || nowMs - w.seen < REGROW_DELAY_MS ? 1 : 0;
          if (w.cut === w.want) continue;
          stir();
          w.cut = w.want > w.cut ? Math.min(1, w.cut + step) : Math.max(0, w.cut - step);
          const t = w.cut * w.cut * (3 - 2 * w.cut);
          const away = !!w.group.userData.placingHidden;
          w.group.visible = !away && w.cut < 1;
          w.low.visible = !away && w.cut > 0;
          fadeGroup(w.group, 1 - t);
          fadeGroup(w.low, t);
        }
        // What hangs on a wall goes with it once it is half way down, and comes back as it grows past half way.
        const hang = new Set<string>();
        for (const [id, w] of s.walls)
          if (w.cut >= 0.5) for (const p of heldRef.current.get(id) ?? []) hang.add(p);
        const shown = hiddenHeld.current;
        let changed = false;
        for (const [id, back] of shown)
          if (!hang.has(id)) {
            back();
            shown.delete(id);
            changed = true;
          }
        for (const id of hang)
          if (!shown.has(id)) {
            shown.set(id, s.lift(id));
            changed = true;
          }
        if (changed) {
          posters.hide(new Set(shown.keys()));
          idleRef.current?.hide(new Set(shown.keys()));
        }
        // The roof over you is lifted off, and so is any roof standing between the camera and you, so a turn never
        // leaves you behind a building.
        const hidden = new Set<string>();
        const over = roofOver(roofs, focus);
        if (over) hidden.add(over);
        // Editing, every roof is off, so the whole floor plan is in reach (the owner, 2026-11-27).
        if (!self) for (const id of s.roofs.keys()) hidden.add(id);
        for (const [id, r] of s.roofs) if (inTheWay(r.group)) hidden.add(id);
        // Each roof eases: it rises and fades as it lifts off, and settles back the same way.
        const roofStep = Math.min(1, (dt * 1000) / ROOF_MS);
        for (const [id, r] of s.roofs) {
          const want = hidden.has(id) ? 1 : 0;
          if (r.lift === want) continue;
          stir();
          r.lift = want > r.lift ? Math.min(1, r.lift + roofStep) : Math.max(0, r.lift - roofStep);
          const t = r.lift * r.lift * (3 - 2 * r.lift);
          r.group.position.z = ROOF_LIFT * t;
          r.group.visible = r.lift < 1;
          for (const m of r.mats) {
            m.transparent = t > 0;
            m.opacity = 1 - t;
            m.depthWrite = t === 0;
          }
        }
      }
      screensRef.current?.update(seatedFeet);
      // An idle Screen's logo turns at its own calm pace, redrawn only when due and in view (idle-screens.ts).
      idleRef.current?.tick(now, e.camera.projectionMatrix);
      // Every door any character drawn here stands near opens, and shuts behind them (door-motion.ts).
      staticRef.current.doors.update(
        [...figures.values()].filter((f) => f.group.visible).map((f) => f.group.position),
        now,
        dt * 1000,
      );
      // The sun follows the middle of the view (your feet when walking), so its shadows cover what you see.
      selfFeet = self;
      fx.update(now);
      if (fx.active) stir();
      // Cars drive at whatever pace the scene draws and never wake it (road.md "Performance").
      if (!traffic && roadsRef.current.length > 0) traffic = new RoadTraffic(e.scene);
      if (traffic) {
        const cars = traffic.update(roadsRef.current, Date.now() / 1000, e.camera.projectionMatrix);
        if (cars !== carsShown) {
          carsShown = cars;
          canvas.dataset.cars = String(cars);
        }
      }
      dogs.update(now, dt, (id) => {
        const bed = staticRef.current.byId.get(id);
        return bed?.type === 'shape' ? bed : undefined;
      });
      const middle = focus ?? { x: 0, y: 0 };
      e.look.follow(middle.x, middle.y);
      grassRef.current?.update(now / 1000);
      // Nothing draws until the programs it needs have compiled in parallel: the first frame waits with the floor
      // showing, and a newcomer holds the scene a moment, never the page (3d-engine.md "Performance").
      // The materials the scene makes later compile with its first frame, in parallel, so none compiles mid-walk.
      if (!shown) void e.warmup.prewarm(e.later, e.camera, e.scene);
      if (!e.warmup.mayDraw(passes, now)) {
        stir();
        return;
      }
      e.outline.render(e.renderer, e.scene, e.camera);
      if (!shown) {
        shown = true;
        canvas.setAttribute('data-real-3d-ready', '');
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      main.removeEventListener('pointermove', stir);
      main.removeEventListener('pointerdown', stir);
      main.removeEventListener('wheel', stir);
      window.removeEventListener('keydown', stir);
      const e = engine.current;
      for (const fig of figures.values()) {
        e?.scene.remove(fig.group);
        fig.rig.dispose();
      }
      kit.dispose();
      unsubscribe();
      fx.dispose();
      dogs.dispose();
      traffic?.dispose();
      shadowGeo.dispose();
    };
  }, [walls, roofs, rooms, posters]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-real-3d-canvas=""
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
