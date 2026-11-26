'use client';

// Real 3D's ink (docs/specs/008-canvas/3d-engine.md "The camera and the pixel look"): the drawings and sprites are
// outlined in a dark ink, so the scene is too. It is drawn into a target at the scene's pixel size, then copied to the
// screen with a one-pixel ink line wherever something stands in front of what is behind it (a jump in depth) or
// against the floor (the edge of what was drawn), on the nearer side, as a pixel artist outlines a sprite.

import * as THREE from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform float k;
uniform float persp;
uniform float threshold;
uniform vec3 ink;
uniform float inkAlpha;
varying vec2 vUv;

// 1 / w, the perspective's divisor, from the depth buffer (projection.ts's depth row): it changes linearly across any
// flat face on the screen, so a face seen at a grazing angle is never mistaken for an edge.
float q(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  float near = z / (z / persp - k);
  return 1.0 / (1.0 - near / persp);
}

void main() {
  vec4 c = texture2D(tColor, vUv);
  bool edge = false;
  if (c.a > 0.9) {
    float l = texture2D(tColor, vUv - vec2(texel.x, 0.0)).a;
    float r = texture2D(tColor, vUv + vec2(texel.x, 0.0)).a;
    float d = texture2D(tColor, vUv - vec2(0.0, texel.y)).a;
    float u = texture2D(tColor, vUv + vec2(0.0, texel.y)).a;
    if (min(min(l, r), min(d, u)) < 0.5) edge = true;
    else {
      float qc = q(vUv);
      float bx = 2.0 * qc - q(vUv - vec2(texel.x, 0.0)) - q(vUv + vec2(texel.x, 0.0));
      float by = 2.0 * qc - q(vUv - vec2(0.0, texel.y)) - q(vUv + vec2(0.0, texel.y));
      // Nearer than both neighbours on a line: the front edge of a step or a corner.
      edge = max(bx, by) > threshold * qc;
    }
  }
  if (edge) {
    gl_FragColor = vec4(mix(c.rgb, ink, inkAlpha), 1.0);
  } else {
    gl_FragColor = c;
  }
}`;

export type OutlinePass = {
  setSize: (width: number, height: number) => void;
  render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;
  dispose: () => void;
};

export function createOutlinePass(opts: {
  k: number;
  perspective: number;
  ink: number;
}): OutlinePass {
  const depth = new THREE.DepthTexture(1, 1);
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthTexture: depth,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    // Smooth edges, as the browser draws the flat art.
    samples: 4,
  });
  const ink = new THREE.Color(opts.ink);
  const texel = new THREE.Vector2(1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: depth },
      texel: { value: texel },
      k: { value: opts.k },
      persp: { value: opts.perspective },
      threshold: { value: 0.004 },
      ink: { value: new THREE.Vector3(ink.r, ink.g, ink.b) },
      inkAlpha: { value: 0.55 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    setSize(width, height) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      target.setSize(w, h);
      texel.set(1 / w, 1 / h);
    },
    render(renderer, scene, camera) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(quadScene, quadCamera);
    },
    dispose() {
      target.dispose();
      depth.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
