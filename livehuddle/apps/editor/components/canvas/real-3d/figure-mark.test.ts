import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGURE_ALPHA, markFigure, solidBothSides } from './figure-mark';

// The Space's projection mirrors the screen, so a one-sided character material drew only its inner faces there (the
// owner, 2026-11-27: "I can see through the back of the character models head into the eyes").
function compiled(m: THREE.Material, lib: { vertexShader: string; fragmentShader: string }) {
  const shader = { ...lib, uniforms: {} } as unknown as Parameters<
    THREE.Material['onBeforeCompile']
  >[0];
  m.onBeforeCompile(shader, null as unknown as THREE.WebGLRenderer);
  return shader.fragmentShader;
}

describe('figure materials', () => {
  for (const [name, make] of [
    ['markFigure', () => markFigure(new THREE.MeshLambertMaterial())],
    ['solidBothSides', () => solidBothSides(new THREE.MeshLambertMaterial())],
  ] as const) {
    it(`${name} draws both sides, keeps each face's own normal, and shadows as before`, () => {
      const m = make();
      expect(m.side).toBe(THREE.DoubleSide);
      expect(m.shadowSide).toBe(THREE.BackSide);
      const frag = compiled(m, THREE.ShaderLib.lambert);
      expect(frag).not.toContain('#include <normal_fragment_begin>');
      expect(frag).not.toContain('gl_FrontFacing');
      expect(frag).toContain('float faceDirection = 1.0;');
    });
  }

  it('a figure keeps its mark for the ink pass', () => {
    const frag = compiled(markFigure(new THREE.MeshLambertMaterial()), THREE.ShaderLib.lambert);
    expect(frag).toContain(`gl_FragColor.a = ${FIGURE_ALPHA.toFixed(2)};`);
  });

  it('an unlit prop compiles unchanged but for its sides', () => {
    const m = solidBothSides(new THREE.MeshBasicMaterial());
    expect(compiled(m, THREE.ShaderLib.basic)).toBe(THREE.ShaderLib.basic.fragmentShader);
    expect(m.side).toBe(THREE.DoubleSide);
  });
});
