import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { grassField } from '@/lib/real-3d/scene-grass';
import { grassMesh } from './grass-field';

const lawn = { id: 'lawn', type: 'shape', shape: 'grass', x: 0, y: 0, width: 1600, height: 1200 };

describe('grassMesh', () => {
  it('draws nothing without a lawn', () => {
    expect(grassMesh(grassField([]))).toBeNull();
  });

  it('draws the blades as one instanced draw and the flowers as one more', () => {
    const field = grassField([lawn] as never);
    const g = grassMesh(field)!;
    const meshes = g.object.children as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(2);
    expect(meshes[0]!.count).toBe(field.count);
    expect(meshes[1]!.count).toBe(field.flowerCount);
    // Both share one material, so the wind is one uniform a frame.
    expect(meshes[0]!.material).toBe(meshes[1]!.material);
    // A blade's matrix stands it at its root, as tall as the field says.
    const m = new THREE.Matrix4();
    meshes[0]!.getMatrixAt(0, m);
    const e = m.elements;
    expect(e[12]).toBeCloseTo(field.blades[0]!, 4);
    expect(e[13]).toBeCloseTo(field.blades[1]!, 4);
    expect(e[10]).toBeCloseTo(field.blades[3]!, 4);
    g.update(1.5);
    g.dispose();
  });
});
