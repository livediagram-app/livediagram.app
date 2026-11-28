'use client';

// Real 3D's moment preview (docs/specs/008-canvas/3d-engine.md "Moments"): one piece in the scene's light, its walk-up
// moment replayed every few seconds from your side, to check by eye how each one plays in the round. Development only.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Element } from '@livehuddle/document';
import { createLook } from '@/components/canvas/real-3d/scene-look';
import { MomentFx } from '@/components/canvas/real-3d/moment-fx';
import { hasMoment, MOMENT_MS } from '@/lib/piece-moments';
import { piecesMesh } from '@/lib/real-3d/scene-pieces';
import { SPACE_3D_TILT_DEG } from '@/lib/space-3d/space-3d-camera';

const SIZE = { w: 720, h: 560 };

export function MomentPreview({ el }: { el: Element }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || el.type !== 'shape' || !hasMoment(el.shape)) return;
    const kind = el.shape;
    THREE.ColorManagement.enabled = false;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setSize(SIZE.w, SIZE.h, false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b);
    const world = new THREE.Group();
    world.scale.y = -1;
    scene.add(world);
    const look = createLook(scene, renderer);
    const b = piecesMesh([el]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.colours, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
    const piece = new THREE.Mesh(g, look.mats.solid);
    piece.castShadow = true;
    world.add(piece);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshLambertMaterial({ color: 0x4b6b3a }),
    );
    floor.receiveShadow = true;
    floor.position.z = -0.3;
    world.add(floor);
    // The effects draw into the world group, flipped as the live scene's canvas coordinates are.
    const fxScene = world as unknown as THREE.Scene;
    const fx = new MomentFx(fxScene, look.mats.solid);
    const t = (SPACE_3D_TILT_DEG * Math.PI) / 180;
    const cam = new THREE.PerspectiveCamera(32, SIZE.w / SIZE.h, 10, 4000);
    const d = 420;
    cam.position.set(0, -d * Math.sin(t), d * Math.cos(t) + 40);
    cam.up.set(0, 0, 1);
    cam.lookAt(0, 0, 40);
    const feet = { x: -el.width / 2 - 30, y: el.height / 2 + 10 };
    let raf = 0;
    let next = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now >= next) {
        fx.start(
          el,
          kind,
          -1,
          feet,
          () => {
            piece.visible = false;
            return () => {
              piece.visible = true;
            };
          },
          now,
        );
        next = now + MOMENT_MS[kind] + 700;
      }
      fx.update(now);
      look.follow(0, 0);
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      fx.dispose();
      look.dispose();
      renderer.dispose();
    };
  }, [el]);
  return <canvas ref={ref} style={{ width: SIZE.w, height: SIZE.h }} data-moment-preview="" />;
}
