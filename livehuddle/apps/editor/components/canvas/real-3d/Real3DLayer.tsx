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
import { placingPiece } from '@/lib/real-3d/placing-piece';
import { pieceFacing } from '@livehuddle/document';
import { setModelFootprints } from '@livehuddle/avatar/office-geometry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { selectionMoving, useCanvasGesture } from '@liveworkspace/workbench/lib/canvas-gesture';
import * as THREE from 'three';
import type { Element } from '@livehuddle/document';
import { spaceWalls } from '@/lib/space-3d/space-3d-walls';
import { spaceRoofs, roofOver } from '@/lib/space-3d/space-3d-roofs';
import { cutAwayIds, frontWallIds, spaceRooms } from '@/lib/space-3d/space-3d-cutaway';
import { space3DTiltNow } from '@/lib/space-3d/space-3d-preference';
import { wallHeldPieces } from '@/lib/real-3d/wall-held-pieces';
import { clipMatrix, scaleZ } from '@/lib/real-3d/projection';
import { setEye } from './scene-look';
import { contactShadows } from './contact-shadows';
import { floorHeightAt, modelled, padTops, piecesMesh } from '@/lib/real-3d/scene-pieces';
import { AVATAR_PAD_HEIGHT } from '@/lib/real-3d/models/pad';
import { RISE } from '@/lib/real-3d/models/kit';
import { grassKey, onLawn } from '@/lib/real-3d/scene-grass';
import { RoadTraffic } from './road-traffic-mesh';
import { trafficRoads, type TrafficRoad } from '@/lib/real-3d/road-traffic';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { setReal3DModels } from '@/lib/real-3d/real-3d-pick';
import { installScenePicking } from './scene-picking';
import { lookKey, type CharacterLook } from '@/lib/real-3d/character';
import { CharacterKit, CharacterRig, type WalkerPose } from './character-rig';
import { FigureMotion } from '@/lib/real-3d/figure-motion';
import { FrameGovernor, startLevel } from '@/lib/real-3d/adaptive-quality';
import { MomentFx } from './moment-fx';
import { OfficeDogs } from './office-dog';
import { floorPointer } from '@/lib/space-3d/floor-pointer';
import { useOptionalSelectionStore } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import type { PieceBounds, PiecesTriangles } from '@/lib/real-3d/piece-pick';
import { hasMoment, latestMoments, subscribeMoments } from '@/lib/piece-moments';
import { headRisePx, writeHeadRise } from '@/lib/real-3d/head-rise';
import {
  acrossFor,
  buildGroup,
  CALM_AFTER_MS,
  CUT_MS,
  deviceHints,
  emptySceneState,
  FEET_X,
  FEET_Y,
  fadeGroup,
  MAX_RATIO,
  REGROW_DELAY_MS,
  ROOF_LIFT,
  ROOF_MS,
  SEAT_CAP,
  seatMemo,
  SPRITE_UNIT,
  standsInWall,
  type Figure,
  type SceneState,
} from './real3d-scene-kit';
import { useReal3DEngine } from './useReal3DEngine';
import { useSceneWalls } from './useSceneWalls';
import { useSceneClocks } from './useSceneClocks';
import { usePlacingPreview } from './usePlacingPreview';
import { useSceneGrass } from './useSceneGrass';
import { useSceneSelection } from './useSceneSelection';

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
  const engineRef = useReal3DEngine(canvasRef);
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

  // The Posters' pictures, quads of their own over their frames (poster-pictures.ts).
  const posters = usePosterPictures(() => engineRef.current?.scene ?? null, pictureSource);
  // Idle Screens' logo, one mesh on one shared texture (idle-screens.ts).
  const idleRef = useRef<IdleScreens | null>(null);
  const idlePlaces = useRef<ReadonlyMap<string, readonly number[]>>(new Map());
  useEffect(() => {
    const e = engineRef.current;
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
  }, [engineRef]);

  // The static scene: walls (each its own, to cut down), roofs (each its own, to hide the one you stand under), pieces.
  const staticRef = useRef<SceneState>(emptySceneState());
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
  useSceneWalls(engineRef, canvasRef, staticRef, walls, roofs, paletteKey);
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
    const e = engineRef.current;
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
    disposers.push(installScenePicking(e.camera, canvas, piecesBuilt, () => elementsRef.current));
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
  }, [engineRef, pieceBase, paletteKey, posters]);

  // The pieces a gesture is changing, drawn on their own over the frozen geometry they are lifted out of.
  const liftedRef = useRef(new Map<string, () => void>());
  useEffect(() => {
    const e = engineRef.current;
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
  }, [engineRef, elements, frozen, posters]);
  useSceneClocks(engineRef, staticRef, elements, pieceBase, paletteKey);
  usePlacingPreview(engineRef, canvasRef, staticRef, elements, walls);
  // The gesture over: what was lifted goes back (the geometry is rebuilt from the board as it now is).
  useEffect(() => {
    if (frozen) return;
    for (const back of liftedRef.current.values()) back();
    liftedRef.current.clear();
  }, [frozen]);

  const grassRef = useSceneGrass(engineRef, elementsRef, surfaceRef, lawnKey);

  useSceneSelection(engineRef, staticRef, markSelection, selectionStore);

  // The frame loop: the camera from the stage, the characters from their walkers, the cut-away from your feet.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const main = canvas.parentElement;
    if (!main) return;
    const figures = new Map<Element | HTMLElement, Figure>();
    const kit = new CharacterKit();
    const scene = engineRef.current!.scene;
    const fx = new MomentFx(scene, engineRef.current!.mats.solid);
    // Each Pet Bed's dog, read from its hidden drawing (office-dog.ts).
    const dogs = new OfficeDogs(scene, main);
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
      { scene: engineRef.current!.scene, camera: engineRef.current!.camera },
      {
        scene: engineRef.current!.outline.quad.scene,
        camera: engineRef.current!.outline.quad.camera,
      },
    ];
    // How sharp to draw, for this device and kept by its own frame rate (adaptive-quality.ts).
    const governor = new FrameGovernor(startLevel(deviceHints(engineRef.current?.renderer)));
    const stir = () => {
      busyUntil = performance.now() + CALM_AFTER_MS;
    };
    main.addEventListener('pointermove', stir, { passive: true });
    main.addEventListener('pointerdown', stir, { passive: true });
    main.addEventListener('wheel', stir, { passive: true });
    window.addEventListener('keydown', stir);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const e = engineRef.current;
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
      for (const fig of figures.values()) {
        scene.remove(fig.group);
        fig.rig.dispose();
      }
      kit.dispose();
      unsubscribe();
      fx.dispose();
      dogs.dispose();
      traffic?.dispose();
      shadowGeo.dispose();
    };
  }, [engineRef, grassRef, walls, roofs, rooms, posters]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-real-3d-canvas=""
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
