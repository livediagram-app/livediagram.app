'use client';

import { seatSurface } from '@/lib/real-3d/seat-surface';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createLook } from '@/components/canvas/real-3d/scene-look';
import { MomentPreview } from './MomentPreview';
import { WalkPreview } from './WalkPreview';
import { PortraitSheet } from './PortraitSheet';
import { FURNITURE_ART, OFFICE_ART, type Element } from '@livehuddle/document';
import { seatsACharacter } from '@livehuddle/avatar/office-geometry';
import { seatPoints } from '@livehuddle/avatar/seats';
import { DEFAULT_AVATAR_CONFIG } from '@livehuddle/avatar/config';
import { parseAvatarStatus } from '@livehuddle/avatar/status';
import { parseAvatarReactionKind } from '@livehuddle/avatar/reactions';
import { behaviourStill } from '@/lib/avatar-palette';
import { piecesMesh } from '@/lib/real-3d/scene-pieces';
import { lookKey, type CharacterLook } from '@/lib/real-3d/character';
import { SPACE_3D_TILT_DEG } from '@/lib/space-3d/space-3d-camera';
import { loadGamePack } from '@/components/canvas/real-3d/game-figure';
import {
  CharacterKit,
  CharacterRig,
  type RigPose,
} from '@/components/canvas/real-3d/character-rig';

const CELL = { w: 200, h: 200 };
/** Canvas px per sprite pixel at Regular size. */
const UNIT = (60 / 24) * 1.9; // Regular, as the Space draws it (size-scale.ts)
const FACINGS = ['n', 'e', 's', 'w'] as const;
const DRINKS = ['coffee', 'water', 'juice', 'soda'];
const YAW: Record<string, number> = {
  down: 0,
  left: Math.PI / 2,
  up: Math.PI,
  right: -Math.PI / 2,
};

type Cell = { kind: string; facing: (typeof FACINGS)[number]; turn: number };

/** The drawn-live kinds' plan boxes. */
const SIZES: Record<string, [number, number]> = {
  screen: [120, 24],
  'room-sign': [56, 16],
  portal: [72, 112],
};

function elementOf(spec: string, facing: string): Element {
  // `kind@variant` draws a kind's type (a tree's species, office.md "Tree species").
  const [kind = spec, variant] = spec.split('@');
  const art =
    (FURNITURE_ART as Record<string, { front: { width: number; height: number } }>)[kind] ??
    (OFFICE_ART as Record<string, { front: { width: number; height: number } }>)[kind];
  const across = facing === 'e' || facing === 'w';
  const w = art?.front.width ?? SIZES[kind]?.[0] ?? 80;
  const h = art?.front.height ?? SIZES[kind]?.[1] ?? 80;
  return {
    id: `${kind}-${facing}`,
    type: 'shape',
    shape: kind,
    x: -(across ? h : w) / 2,
    y: -(across ? w : h) / 2,
    width: across ? h : w,
    height: across ? w : h,
    chairFacing: facing,
    ...(variant ? { variant } : {}),
  } as unknown as Element;
}

export function Real3DSheet() {
  const [moment] = useState(() =>
    typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('moment'),
  );
  const [walk] = useState(() =>
    typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('walk'),
  );
  const [portraits] = useState(
    () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('portraits'),
  );
  if (portraits) return <PortraitSheet />;
  if (moment) return <MomentPreview el={elementOf(moment, 'n')} />;
  if (walk !== null) {
    const q = new URLSearchParams(location.search);
    const at = q.get('at');
    return (
      <WalkPreview
        timeScale={Number(walk) || 1}
        side={q.get('cam') === 'side'}
        at={at === null ? null : Number(at)}
      />
    );
  }
  return <Sheet />;
}

function Sheet() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [only] = useState(() =>
    typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('kinds'),
  );
  // Every kind with a drawing, plus the drawn-live kinds (a Screen, a Room Sign, a Portal) when asked for by name.
  const kinds = only
    ? only.split(',').filter(Boolean)
    : Object.keys({ ...FURNITURE_ART, ...OFFICE_ART });
  const cells: Cell[][] = kinds.map((kind) => [
    ...[0, 1, 2, 3].map((turn) => ({ kind, facing: 'n' as const, turn })),
    ...(['e', 's', 'w'] as const).map((facing) => ({ kind, facing, turn: 0 })),
  ]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true;
    THREE.ColorManagement.enabled = false;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(1);
    const cols = 7;
    renderer.setSize(cols * CELL.w, kinds.length * CELL.h, false);
    renderer.setScissorTest(true);
    // The live scene's own lights and materials (scene-look.ts), so a piece looks here as it does in a Space.
    const line = new THREE.LineBasicMaterial({ color: 0x2b2438, transparent: true, opacity: 0.3 });
    (async () => {
      const kit = new CharacterKit();
      await Promise.all([loadGamePack('men'), loadGamePack('women')]);
      const base = { ...DEFAULT_AVATAR_CONFIG, shirt: '#0ea5e9' };
      // A character standing (or walking, waving, sat) at the origin, from
      // `figure:clothing:hair:gender:doing:shirt:build` (the last three optional). `doing` may join several with `+`:
      // `st-<status>` wears a status's signature, `act-<kind>` a Behaviour at its card's moment, `hand` a raised hand.
      const character = (
        spec: string,
        doing?: string,
        seat?: ReturnType<typeof seatSurface>,
      ): THREE.Object3D => {
        const [clothing, hair, gender, act, shirt, build] = spec.split(':');
        const look: CharacterLook = {
          ...base,
          clothing: clothing || base.clothing,
          hair: hair || base.hair,
          gender: gender || base.gender,
          hairColour: hair === 'afro' ? 'black' : hair === 'bob' ? 'blonde' : base.hairColour,
          shirt: shirt ? `#${shirt}` : base.shirt,
          build: build || base.build,
        };
        const rig = new CharacterRig(kit.material);
        const key = lookKey(look);
        rig.wear(key, kit.geometries(key, look), look);
        const doings = (doing ?? act ?? '').split('+');
        const what =
          doings.find((d) => !d.startsWith('st-') && !d.startsWith('act-') && d !== 'hand') ?? '';
        const status = parseAvatarStatus(doings.find((d) => d.startsWith('st-'))?.slice(3));
        const move = parseAvatarReactionKind(doings.find((d) => d.startsWith('act-'))?.slice(4));
        rig.hold(
          what === 'flag' ? 'flag' : what === 'cup' || DRINKS.includes(what) ? 'cup' : null,
          DRINKS.includes(what) ? what : 'coffee',
        );
        rig.root.scale.setScalar(UNIT);
        const pose: RigPose = {
          walking: what === 'walk',
          seated: what === 'sit',
          lift: 0,
          wave: what === 'flag' ? 0 : null,
          holding: what === 'cup' ? 'coffee' : DRINKS.includes(what) ? what : null,
          pose: move
            ? behaviourStill(move)
            : what === 'cheer'
              ? { armsUp: true }
              : what === 'jack'
                ? { armsOut: true, legsApart: true }
                : what === 'wave'
                  ? { waveArm: true }
                  : null,
          ...(status ? { status } : null),
          ...(doings.includes('hand') ? { handUp: true } : null),
        };
        // A walk is caught mid-stride.
        rig.pose(pose, what === 'walk' ? 0.13 : 0.016, UNIT, 0, undefined, seat);
        if (what === 'walk') for (let i = 0; i < 6; i++) rig.pose(pose, 0.02, UNIT, 0);
        // A gesture eases in over a few frames: settled before it is drawn.
        if (status || move || doings.includes('hand'))
          for (let i = 0; i < 30; i++) rig.pose(pose, 0.02, UNIT, 0);
        return rig.root;
      };
      if (!alive) return;
      cells.forEach((row, r) =>
        row.forEach((cell, c) => {
          const scene = new THREE.Scene();
          scene.background = new THREE.Color(0x1e293b);
          const look = createLook(scene, renderer);
          look.catcher.visible = false;
          const { solid, glass } = look.mats;
          const world = new THREE.Group();
          world.scale.y = -1;
          scene.add(world);
          if (cell.kind.startsWith('figure:')) {
            const fig = character(cell.kind.slice(7));
            fig.rotation.z = YAW[{ n: 'down', e: 'right', s: 'up', w: 'left' }[cell.facing]] ?? 0;
            fig.traverse((o) => (o.castShadow = true));
            world.add(fig);
          }
          const isFigure = cell.kind.startsWith('figure:');
          const el = elementOf(cell.kind, cell.facing);
          const b = piecesMesh(isFigure ? [] : [el]);
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
          g.setAttribute('color', new THREE.Float32BufferAttribute(b.colours, 3));
          g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
          const piece = new THREE.Mesh(g, solid);
          piece.castShadow = true;
          piece.receiveShadow = true;
          world.add(piece);
          if (b.glassPositions.length) {
            const gg = new THREE.BufferGeometry();
            gg.setAttribute('position', new THREE.Float32BufferAttribute(b.glassPositions, 3));
            gg.setAttribute('color', new THREE.Float32BufferAttribute(b.glassColours, 3));
            gg.setAttribute('normal', new THREE.Float32BufferAttribute(b.glassNormals, 3));
            world.add(new THREE.Mesh(gg, glass));
          }
          const lg = new THREE.BufferGeometry();
          lg.setAttribute('position', new THREE.Float32BufferAttribute(b.lines, 3));
          world.add(new THREE.LineSegments(lg, line));
          // `?beside=1` stands a character beside each piece, to judge its height against a person.
          if (!isFigure && new URLSearchParams(location.search).get('beside') === '1') {
            const fig = character('');
            fig.traverse((o) => (o.castShadow = true));
            const w = (el as unknown as { width: number }).width;
            fig.position.set(w / 2 + 24, 0, 0);
            world.add(fig);
          }
          let sitter: { x: number; y: number } | null = null;
          if (seatsACharacter(cell.kind))
            for (const s of seatPoints(el as never)) {
              // Seated as the Space seats them: on the seat found in the piece's own geometry (seat-surface.ts).
              const seat = seatSurface(
                b,
                b.bounds,
                () => cell.kind,
                s,
                YAW[s.facing] ?? 0,
                UNIT / (60 / 24),
                70,
              );
              const fig = character('', 'sit', seat);
              fig.traverse((o) => (o.castShadow = true));
              fig.position.set(s.x, s.y, 0);
              sitter ??= s;
              fig.rotation.z = YAW[s.facing] ?? 0;
              world.add(fig);
            }
          // Framed to fit: the camera backs off until the whole piece (and its sitters) is in the cell.
          world.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(world);
          const mid = bounds.getCenter(new THREE.Vector3());
          const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
          // A floor so pieces read as standing on it.
          const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(600, 600),
            new THREE.MeshLambertMaterial({ color: 0x3a3f4b }),
          );
          floor.position.z = -0.5;
          floor.receiveShadow = true;
          world.add(floor);
          // `?face=1` frames a character's head and shoulders, nearly level, to judge its face.
          const face = isFigure && new URLSearchParams(location.search).get('face') === '1';
          // `?close=1` frames a whole character closer, to judge what it wears and holds.
          const close = isFigure && new URLSearchParams(location.search).get('close') === '1';
          // `?seat=1` looks at a piece's first sitter from nearly level and close, to judge how they sit.
          const seatView = !!sitter && new URLSearchParams(location.search).get('seat') === '1';
          if (seatView && sitter) mid.set(sitter.x, sitter.y, 30);
          if (face) mid.z = bounds.max.z - 10;
          if (close) mid.z = bounds.max.z - 30;
          const t = ((face || seatView ? 80 : SPACE_3D_TILT_DEG) * Math.PI) / 180;
          const turn = (cell.turn * Math.PI) / 2;
          const d = seatView
            ? 300
            : face
              ? 30
              : close
                ? 150
                : Math.max(isFigure ? 120 : 260, radius / Math.sin((15 * Math.PI) / 180));
          const cam = new THREE.PerspectiveCamera(32, CELL.w / CELL.h, 10, 3000);
          // The default camera stands south (toward +y on the canvas, -y here) and looks north and down; a turn walks it
          // clockwise round.
          const ox = -Math.sin(turn) * d * Math.sin(t);
          const oy = -Math.cos(turn) * d * Math.sin(t);
          cam.position.set(mid.x + ox, mid.y + oy, d * Math.cos(t) + mid.z);
          cam.up.set(0, 0, 1);
          cam.lookAt(mid.x, mid.y, mid.z);
          const x = c * CELL.w;
          const y = (kinds.length - 1 - r) * CELL.h;
          renderer.setViewport(x, y, CELL.w, CELL.h);
          renderer.setScissor(x, y, CELL.w, CELL.h);
          renderer.render(scene, cam);
          look.dispose();
        }),
      );
      setReady(true);
    })().catch((e: unknown) => setError(String((e as Error)?.stack ?? e)));
    return () => {
      alive = false;
      renderer.dispose();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- drawn once on mount from the URL's kinds.
  }, []);

  return (
    <div
      style={{ background: '#0b1020', color: '#fff', font: '12px sans-serif', padding: 8 }}
      data-ready={ready ? '' : undefined}
    >
      <div style={{ display: 'grid', gridTemplateColumns: `120px ${7 * CELL.w}px` }}>
        <div>
          {kinds.map((k) => (
            <div key={k} style={{ height: CELL.h, display: 'flex', alignItems: 'center' }}>
              {k}
            </div>
          ))}
        </div>
        <canvas ref={ref} style={{ width: 7 * CELL.w, height: kinds.length * CELL.h }} />
      </div>
      {error ? <pre data-error="">{error}</pre> : null}
      <div>Columns: facing n at camera turns 0, 1, 2, 3; then facings e, s, w at turn 0.</div>
    </div>
  );
}
