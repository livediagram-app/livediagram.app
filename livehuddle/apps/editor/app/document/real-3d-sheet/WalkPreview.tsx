'use client';

// Real 3D's walk preview (docs/specs/008-canvas/3d-engine.md "Characters"): one character walking a set route on a
// checked floor (straight, diagonal, a curve, a run, stops and turns on the spot), followed by the walk's camera, to
// judge its stride and heading by eye. `?walk=<time scale>` (0.25 for slow motion). Development only.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  CharacterKit,
  CharacterRig,
  type RigPose,
} from '@/components/canvas/real-3d/character-rig';
import { createLook } from '@/components/canvas/real-3d/scene-look';
import { DEFAULT_AVATAR_CONFIG } from '@livehuddle/avatar/config';
import { FigureMotion, type Facing } from '@/lib/real-3d/figure-motion';
import { SPACE_3D_TILT_DEG } from '@/lib/space-3d/space-3d-camera';

const SIZE = { w: 900, h: 620 };
const UNIT = 60 / 24;
const WALK = 260;
const RUN = 260 * 1.9;

/** The route: each leg a heading (canvas px a second, as the keys move you) or a stop, for some seconds. */
const ROUTE: { vx: number; vy: number; s: number; facing?: Facing; curve?: number }[] = [
  { vx: 0, vy: 0, s: 1 },
  { vx: WALK, vy: 0, s: 1.4 },
  { vx: WALK / Math.SQRT2, vy: WALK / Math.SQRT2, s: 1.4 },
  { vx: 0, vy: WALK, s: 1 },
  { vx: 0, vy: 0, s: 0.8 },
  { vx: 0, vy: 0, s: 0.8, facing: 'left' },
  { vx: -WALK / Math.SQRT2, vy: -WALK / Math.SQRT2, s: 1.4 },
  { vx: 0, vy: -WALK, s: 2.4, curve: 1.6 },
  { vx: RUN, vy: 0, s: 1.3 },
  { vx: RUN / Math.SQRT2, vy: RUN / Math.SQRT2, s: 1 },
  { vx: 0, vy: 0, s: 1.2 },
  { vx: -WALK * 0.45, vy: 0, s: 1.6 },
  { vx: 0, vy: 0, s: 1 },
];
const ROUTE_S = ROUTE.reduce((n, l) => n + l.s, 0);

function checkedFloor(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7c8a6a';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#6d7a5c';
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.repeat.set(60, 60);
  return t;
}

/**
 * `side` puts the camera level beside the walker; `at` (seconds) freezes the route there, stepped at 120 frames a
 * second from the start so the same time always draws the same pose.
 */
export function WalkPreview({
  timeScale,
  side,
  at,
}: {
  timeScale: number;
  side: boolean;
  at: number | null;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    THREE.ColorManagement.enabled = false;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(SIZE.w, SIZE.h, false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b);
    const world = new THREE.Group();
    world.scale.y = -1;
    scene.add(world);
    const look = createLook(scene, renderer);
    const tex = checkedFloor();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1920, 1920),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    floor.receiveShadow = true;
    floor.position.z = -0.05;
    world.add(floor);
    const kit = new CharacterKit();
    const rig = new CharacterRig(look.mats.figure);
    const lookOf = { ...DEFAULT_AVATAR_CONFIG, shirt: '#0ea5e9' };
    rig.wear('walk-preview', kit.geometries('walk-preview', lookOf), lookOf);
    rig.root.scale.setScalar(UNIT);
    const figure = new THREE.Group();
    figure.add(rig.root);
    world.add(figure);
    const t = (SPACE_3D_TILT_DEG * Math.PI) / 180;
    const cam = new THREE.PerspectiveCamera(30, SIZE.w / SIZE.h, 10, 6000);
    cam.up.set(0, 0, 1);
    const motion = new FigureMotion('down');
    const feet = { x: 0, y: 0 };
    let facing: Facing = 'down';
    let clock = 0;
    let last = performance.now();
    let raf = 0;
    const step = (dt: number, now: number) => {
      clock = (clock + dt) % ROUTE_S;
      let at = clock;
      let leg = ROUTE[0]!;
      for (const l of ROUTE) {
        leg = l;
        if (at < l.s) break;
        at -= l.s;
      }
      let { vx, vy } = leg;
      if (leg.curve) {
        const a = (at / leg.s) * leg.curve * Math.PI;
        const c = Math.cos(a);
        const s = Math.sin(a);
        [vx, vy] = [vx * c - vy * s, vx * s + vy * c];
      }
      feet.x += vx * dt;
      feet.y += vy * dt;
      if (leg.facing) facing = leg.facing;
      else if (Math.hypot(vx, vy) > 0)
        facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
      const walking = Math.hypot(vx, vy) > 0;
      motion.update(feet, dt, facing, false);
      const pose: RigPose = {
        walking,
        seated: false,
        lift: 0,
        wave: null,
        holding: null,
        pose: null,
      };
      rig.pose(pose, dt, UNIT, now, { speed: motion.speed / UNIT, turn: motion.turn });
      rig.root.rotation.z = motion.yaw;
      figure.position.set(feet.x, feet.y, 0);
    };
    const draw = () => {
      // The walk's camera: south of you, tilted down, close enough to see the feet.
      const d = side ? 200 : 260;
      if (side) cam.position.set(feet.x, -feet.y - d, 24);
      else cam.position.set(feet.x, -feet.y - d * Math.sin(t), d * Math.cos(t) + 20);
      cam.lookAt(feet.x, -feet.y, 22);
      look.follow(feet.x, feet.y);
      renderer.render(scene, cam);
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = (Math.min(0.1, (now - last) / 1000) || 0) * timeScale;
      last = now;
      step(dt, now);
      draw();
    };
    if (at !== null) {
      for (let i = 0; i < Math.round(at * 120); i++) step(1 / 120, i * 8);
      draw();
    } else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      kit.dispose();
      tex.dispose();
      look.dispose();
      renderer.dispose();
    };
  }, [timeScale, side, at]);
  return <canvas ref={ref} style={{ width: SIZE.w, height: SIZE.h }} data-walk-preview="" />;
}
