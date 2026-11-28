'use client';

// The Road's cars in Real 3D (docs/specs/009-elements/road.md "Traffic", "Performance"): every car on the tab is one
// instanced mesh of the car (its body tinted per car, its wheels, glass and lamps their own colours), so ten roads
// are one draw. Each frame writes the cars on the roads in view straight into the instance buffers: nothing is
// allocated per car or per frame. A car fades in and out as a dissolve (an ordered 4 x 4 threshold on its pixels and
// on its shadow), so it stays opaque to the depth and ink passes. It never wakes the frame loop.

import * as THREE from 'three';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { roadCar } from '@/lib/real-3d/models/road';
import { CAR_STRIDE, laneCars, TRAFFIC_TONES, type TrafficRoad } from '@/lib/real-3d/road-traffic';
import { litMaterial } from './scene-look';

/** The most cars drawn at once; past it the rest wait for a free place. */
export const MAX_CARS = 96;
/** How far past the view's edge a road still counts as in view (clip units). */
const VIEW_MARGIN = 1.1;

const DISSOLVE = /* glsl */ `
  {
    ivec2 cell = ivec2( mod( gl_FragCoord.xy, 4.0 ) );
    const float BAYER[16] = float[16]( 0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0 );
    if ( vFade < ( BAYER[ cell.x + cell.y * 4 ] + 0.5 ) / 16.0 ) discard;
  }`;

/** The car's lit material: its body's corners take the car's colour, and it dissolves by its fade. */
function carMaterial(): THREE.MeshLambertMaterial {
  const m = litMaterial();
  // The lit material's own step (its normals turned to the eye, scene-look.ts) runs first.
  const own = m.onBeforeCompile.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    own(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 carColour;\nattribute float carFade;\nattribute float tint;\nvarying float vFade;',
      )
      .replace(
        '#include <color_vertex>',
        '#include <color_vertex>\nvColor.rgb *= mix( vec3( 1.0 ), carColour, tint );\nvFade = carFade;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n${DISSOLVE}`,
      );
  };
  m.customProgramCacheKey = () => 'road-car';
  return m;
}

/** The car's shadow, dissolving with it. */
function carDepthMaterial(): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float carFade;\nvarying float vFade;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = carFade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n${DISSOLVE}`,
      );
  };
  m.customProgramCacheKey = () => 'road-car-depth';
  return m;
}

/** The car's geometry: body and trim in one, `tint` 1 on the body's corners. */
function carGeometry(): THREE.BufferGeometry {
  const { body, trim } = roadCar();
  const count = (body.positions.length + trim.positions.length) / 3;
  const join = (a: Float32Array, b: Float32Array) => {
    const out = new Float32Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
  };
  const tint = new Float32Array(count);
  tint.fill(1, 0, body.positions.length / 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(join(body.positions, trim.positions), 3));
  g.setAttribute('color', new THREE.BufferAttribute(join(body.colours, trim.colours), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(join(body.normals, trim.normals), 3));
  g.setAttribute('tint', new THREE.BufferAttribute(tint, 1));
  return g;
}

const TONES = new Float32Array(TRAFFIC_TONES.length * 3);
TRAFFIC_TONES.forEach((c, i) => {
  TONES[i * 3] = ((c >> 16) & 255) / 255;
  TONES[i * 3 + 1] = ((c >> 8) & 255) / 255;
  TONES[i * 3 + 2] = (c & 255) / 255;
});

export class RoadTraffic {
  readonly mesh: THREE.InstancedMesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshLambertMaterial;
  private readonly depth: THREE.MeshDepthMaterial;
  private readonly colour: THREE.InstancedBufferAttribute;
  private readonly fade: THREE.InstancedBufferAttribute;
  /** One lane's cars at a time, CAR_STRIDE numbers each. */
  private readonly lane = new Float32Array(MAX_CARS * CAR_STRIDE);
  private readonly corner = new THREE.Vector3();
  private shown = 0;

  constructor(scene: THREE.Scene) {
    this.geometry = carGeometry();
    this.colour = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CARS * 3), 3);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(MAX_CARS), 1);
    this.colour.setUsage(THREE.DynamicDrawUsage);
    this.fade.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('carColour', this.colour);
    this.geometry.setAttribute('carFade', this.fade);
    this.material = carMaterial();
    this.depth = carDepthMaterial();
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_CARS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.customDepthMaterial = this.depth;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  /** Whether any of a road's box lies in the view (its corners' bounds on the screen meet the clip square). */
  private inView(r: TrafficRoad, projection: THREE.Matrix4): boolean {
    const { x, y, width, height } = r.box;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 4; i++) {
      this.corner.set(i & 1 ? x + width : x, i & 2 ? y + height : y, 0).applyMatrix4(projection);
      x0 = Math.min(x0, this.corner.x);
      x1 = Math.max(x1, this.corner.x);
      y0 = Math.min(y0, this.corner.y);
      y1 = Math.max(y1, this.corner.y);
    }
    return x1 > -VIEW_MARGIN && x0 < VIEW_MARGIN && y1 > -VIEW_MARGIN && y0 < VIEW_MARGIN;
  }

  /** Places every car on the roads in view at `seconds` (since the epoch). Returns how many it drew. */
  update(roads: readonly TrafficRoad[], seconds: number, projection: THREE.Matrix4): number {
    let n = 0;
    if (!prefersReducedMotion()) {
      const m = this.mesh.instanceMatrix.array as Float32Array;
      const col = this.colour.array as Float32Array;
      const fade = this.fade.array as Float32Array;
      for (const r of roads) {
        if (n >= MAX_CARS) break;
        if (!this.inView(r, projection)) continue;
        for (let li = 0; li < r.lanes.length && n < MAX_CARS; li++) {
          const lane = r.lanes[li]!;
          const got = laneCars(r.seed, li, lane.length, seconds, this.lane, 0, MAX_CARS - n);
          const dx = (lane.x1 - lane.x0) / lane.length;
          const dy = (lane.y1 - lane.y0) / lane.length;
          for (let c = 0; c < got; c++) {
            const s = this.lane[c * CAR_STRIDE]!;
            const tone = this.lane[c * CAR_STRIDE + 2]!;
            // The car's nose (+y in its model) along the lane: its x axis (dy, -dx), its y axis (dx, dy).
            const o = n * 16;
            m[o] = dy;
            m[o + 1] = -dx;
            m[o + 2] = 0;
            m[o + 3] = 0;
            m[o + 4] = dx;
            m[o + 5] = dy;
            m[o + 6] = 0;
            m[o + 7] = 0;
            m[o + 8] = 0;
            m[o + 9] = 0;
            m[o + 10] = 1;
            m[o + 11] = 0;
            m[o + 12] = lane.x0 + dx * s;
            m[o + 13] = lane.y0 + dy * s;
            m[o + 14] = 0;
            m[o + 15] = 1;
            col[n * 3] = TONES[tone * 3]!;
            col[n * 3 + 1] = TONES[tone * 3 + 1]!;
            col[n * 3 + 2] = TONES[tone * 3 + 2]!;
            fade[n] = this.lane[c * CAR_STRIDE + 1]!;
            n += 1;
          }
        }
      }
    }
    if (n > 0 || this.shown > 0) {
      this.mesh.count = n;
      this.mesh.instanceMatrix.needsUpdate = true;
      this.colour.needsUpdate = true;
      this.fade.needsUpdate = true;
    }
    this.shown = n;
    return n;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.depth.dispose();
  }
}
