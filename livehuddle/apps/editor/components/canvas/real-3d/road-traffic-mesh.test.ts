import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@livehuddle/document';
import { trafficRoads } from '@/lib/real-3d/road-traffic';
import { MAX_CARS, RoadTraffic } from './road-traffic-mesh';

const reduced = vi.hoisted(() => ({ on: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => reduced.on,
}));

// The Road's cars in Real 3D (docs/specs/009-elements/road.md "Traffic", "Performance").
const road = (i: number, y = i * 160) =>
  ({
    id: `road-${i}`,
    type: 'shape',
    shape: 'road',
    x: 0,
    y,
    width: 1600,
    height: 136,
  }) as unknown as Element;

/** A projection that puts the canvas box (0..2000, 0..2000) inside the clip square, the floor flat. */
const view = new THREE.Matrix4()
  .makeScale(1 / 1000, 1 / 1000, 1)
  .premultiply(new THREE.Matrix4().makeTranslation(-1, -1, 0));

describe('RoadTraffic', () => {
  afterEach(() => {
    reduced.on = false;
  });

  it('draws the cars on the roads in view as one instanced mesh, coloured and faded per car', () => {
    const scene = new THREE.Scene();
    const traffic = new RoadTraffic(scene);
    expect(scene.children).toContain(traffic.mesh);
    const roads = trafficRoads([road(0)]);
    let most = 0;
    for (let t = 0; t < 60; t += 0.25)
      most = Math.max(most, traffic.update(roads, 1_700_000_000 + t, view));
    expect(most).toBeGreaterThan(0);
    expect(traffic.mesh.count).toBeLessThanOrEqual(MAX_CARS);
    // The geometry carries the body's tint and the per-car colour and fade.
    const g = traffic.mesh.geometry;
    expect(g.getAttribute('tint')).toBeDefined();
    expect(g.getAttribute('carColour').itemSize).toBe(3);
    expect(g.getAttribute('carFade').itemSize).toBe(1);
    traffic.dispose();
    expect(scene.children).not.toContain(traffic.mesh);
  });

  it('draws nothing for a road out of view, or under reduced motion', () => {
    const traffic = new RoadTraffic(new THREE.Scene());
    const far = trafficRoads([road(0, 50_000)]);
    for (let t = 0; t < 60; t += 0.5) expect(traffic.update(far, 1_700_000_000 + t, view)).toBe(0);
    reduced.on = true;
    const near = trafficRoads([road(0)]);
    for (let t = 0; t < 60; t += 0.5) expect(traffic.update(near, 1_700_000_000 + t, view)).toBe(0);
    expect(traffic.mesh.count).toBe(0);
    traffic.dispose();
  });

  it('places ten long roads of cars a frame well within budget', () => {
    const traffic = new RoadTraffic(new THREE.Scene());
    const roads = trafficRoads(Array.from({ length: 10 }, (_, i) => road(i)));
    const frames = 1800;
    let cars = 0;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) cars += traffic.update(roads, 1_700_000_000 + f / 30, view);
    const perFrame = (performance.now() - t0) / frames;
    // Measured about 0.005 ms a frame (2026-11-28) on an Apple laptop; 0.3 ms leaves room for a slow CI runner.
    expect(perFrame).toBeLessThan(0.3);
    expect(cars / frames).toBeGreaterThan(2);
    console.info(
      `road traffic: ${(perFrame * 1000).toFixed(1)} us/frame, ${(cars / frames).toFixed(1)} cars on average, ${traffic.mesh.geometry.getAttribute('position').count / 3} triangles a car`,
    );
    traffic.dispose();
  });
});
