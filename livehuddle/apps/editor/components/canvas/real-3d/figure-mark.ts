// The characters' mark for the ink pass (docs/specs/008-canvas/3d-engine.md "Characters"; outline-pass.ts): a
// character's pixels are written with alpha FIGURE_ALPHA, so the pass draws its outline against the scene but no ink
// across its facets and no occlusion speckle on it (the owner, 2026-11-27: "so many polygons all over it").
//
// And both its sides drawn, as every Real 3D material is: the Space's projection mirrors the screen (projection.ts),
// so three's winding test turns round there and a one-sided material drew only its inner faces. A head showed the
// inside of its far side, and from behind the face's features through it (the owner, 2026-11-27: "I can see through
// the back of the character models head into the eyes"). A plain camera (the model sheet, the portraits) is not
// mirrored, so no one side suits both; drawn on both, the depth test keeps the near, outer surface.

import * as THREE from 'three';

/**
 * The alpha a character's pixels are written with, so the ink pass knows them (outline-pass.ts FIGURE_ALPHA): opaque,
 * never blended, the value only a mark.
 */
export const FIGURE_ALPHA = 0.95;

type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];

/**
 * three's normal set-up with its two-sided turn taken out: it turns a normal round for a face it thinks is seen from
 * behind, which the mirrored projection gets the wrong way round. A solid's faces carry outward normals and the depth
 * test keeps the outer one, so each face keeps its own.
 */
export const OWN_NORMAL_BEGIN = THREE.ShaderChunk.normal_fragment_begin.replace(
  'gl_FrontFacing ? 1.0 : - 1.0',
  '1.0',
);

function keepNormals(shader: Shader): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <normal_fragment_begin>',
    OWN_NORMAL_BEGIN,
  );
}

function bothSides(m: THREE.Material): void {
  m.side = THREE.DoubleSide;
  // The sun's shadow camera is a plain one: its pass draws the back faces, as it always did for these.
  m.shadowSide = THREE.BackSide;
}

/**
 * A solid a character holds or wears as a prop, drawn on both sides with its own normals: solid under the Space's
 * mirrored projection and a plain camera alike.
 */
export function solidBothSides<M extends THREE.Material>(m: M): M {
  bothSides(m);
  m.onBeforeCompile = keepNormals;
  m.customProgramCacheKey = () => 'solid-both-sides';
  return m;
}

/**
 * Marks a character material for the ink pass and draws it on both sides with its own normals (a clone loses the
 * mark, so each clone is marked again).
 */
export function markFigure<M extends THREE.Material>(m: M): M {
  bothSides(m);
  m.onBeforeCompile = (shader) => {
    keepNormals(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>\n  gl_FragColor.a = ${FIGURE_ALPHA.toFixed(2)};`,
    );
  };
  m.customProgramCacheKey = () => 'figure';
  return m;
}
