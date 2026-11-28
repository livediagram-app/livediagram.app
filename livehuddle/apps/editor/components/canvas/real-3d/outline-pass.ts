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
uniform float aoRadius;
uniform float aoStrength;
varying vec2 vUv;

// 1 / w, the perspective's divisor, from the depth buffer (projection.ts's depth row): it changes linearly across any
// flat face on the screen, so a face seen at a grazing angle is never mistaken for an edge.
float q(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  float near = z / (z / persp - k);
  return 1.0 / (1.0 - near / persp);
}

// How far toward the viewer a pixel stands (canvas px, larger is nearer): q's own depth, before its divisor.
float toward(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return z / (z / persp - k);
}

// Screen-space ambient occlusion: the share of a ring of neighbours standing nearer the viewer than the surface here
// would put them (its slope taken from the pixels either side), within a reach, so a crease (a seat against its back, a
// chair under a desk) darkens while a flat wall or top seen at a slant, and a far step, never do.
float occlusion(vec2 uv) {
  float here = toward(uv);
  vec2 slope = vec2(
    toward(uv + vec2(texel.x, 0.0)) - toward(uv - vec2(texel.x, 0.0)),
    toward(uv + vec2(0.0, texel.y)) - toward(uv - vec2(0.0, texel.y))
  ) * 0.5;
  float hidden = 0.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996;
    float r = aoRadius * (0.35 + 0.65 * fract(float(i) * 0.618));
    vec2 px = vec2(cos(a), sin(a)) * r;
    vec2 o = px * texel;
    if (texture2D(tColor, uv + o).a < 0.5) continue;
    float d = toward(uv + o) - (here + dot(slope, px));
    hidden += smoothstep(0.6, 2.4, d) * (1.0 - smoothstep(10.0, 22.0, d));
  }
  return 1.0 - aoStrength * hidden / 12.0;
}

// A gentle filmic grade: a little more saturation and contrast, highlights rolled off rather than clipped.
vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.14);
  c = (c - 0.5) * 1.07 + 0.5;
  vec3 over = max(c - 0.82, 0.0);
  c = c - over + over / (1.0 + over * 2.6);
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec4 c = texture2D(tColor, vUv);
  if (c.a > 0.01) c.rgb = grade(c.rgb);
  // A character's pixels carry alpha 0.95 (game-figure.ts FIGURE_ALPHA): no occlusion speckle and no ink across its
  // facets inside its outline; its outline against the scene is kept.
  bool figure = c.a > 0.9 && c.a < 0.97;
  if (c.a >= 0.97) c.rgb *= occlusion(vUv);
  bool edge = false;
  if (c.a > 0.9) {
    float l = texture2D(tColor, vUv - vec2(texel.x, 0.0)).a;
    float r = texture2D(tColor, vUv + vec2(texel.x, 0.0)).a;
    float d = texture2D(tColor, vUv - vec2(0.0, texel.y)).a;
    float u = texture2D(tColor, vUv + vec2(0.0, texel.y)).a;
    if (min(min(l, r), min(d, u)) < 0.5) edge = true;
    else if (!figure) {
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
    gl_FragColor = vec4(c.rgb, figure ? 1.0 : c.a);
  }
}`;

export type OutlinePass = {
  setSize: (width: number, height: number) => void;
  render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;
  /** The pass's own screen quad, compiled with the scene before the first frame (shader-warmup.ts). */
  quad: { scene: THREE.Scene; camera: THREE.Camera };
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
      aoRadius: { value: 9 },
      aoStrength: { value: 0.55 },
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
    quad: { scene: quadScene, camera: quadCamera },
    setSize(width, height) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      target.setSize(w, h);
      texel.set(1 / w, 1 / h);
      // The occlusion's reach in screen pixels, at the page's pixel ratio.
      material.uniforms.aoRadius!.value = 9 * Math.min(2, window.devicePixelRatio || 1);
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
