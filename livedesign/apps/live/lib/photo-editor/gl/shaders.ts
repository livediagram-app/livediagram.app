// The GPU compositor's shaders (docs/specs/031-photo/blueprints/photo-engine.md "The GPU compositor"):
// WebGL 2, every buffer premultiplied. The blend modes' formulas are the CPU's (colour/blend.ts),
// one for one, so the screen and the exports agree; the parity test holds them together.
import { BLEND_MODES, HARD_MIX_GIVE } from '@livedesign/photo-engine';

/** The number a blend mode is in the shader. */
export function modeIndex(mode: string): number {
  const i = BLEND_MODES.indexOf(mode as (typeof BLEND_MODES)[number]);
  return i < 0 ? 0 : i;
}

const M = (name: string) => modeIndex(name);

export const QUAD_VS = `#version 300 es
in vec2 a_pos;
uniform vec4 u_rect;   // the quad, photo px: x, y, w, h
uniform vec4 u_view;   // what the target shows, photo px: x, y, w, h
out vec2 v_uv;
void main() {
  v_uv = a_pos;
  vec2 p = u_rect.xy + a_pos * u_rect.zw;
  vec2 ndc = (p - u_view.xy) / u_view.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

// A pass over a whole buffer samples it straight: a fragment reads the texel under it, so no pass turns the
// picture over (QUAD_VS already lays the photo's top at the buffer's top, which the screen shows at the top).
// Flipping here once turned each layer over again at every blend above it, so every second layer showed upside
// down. v_photo is where the fragment is in the view, top-left 0, for what is placed by photo px (the grid,
// Dissolve's noise).
export const FULL_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
out vec2 v_photo;
void main() {
  v_uv = a_pos;
  v_photo = vec2(a_pos.x, 1.0 - a_pos.y);
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
}`;

/** A tile drawn into a buffer: a layer's (premultiplied RGBA), a mask's (grey in R), or a solid. */
export const TILE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform int u_kind;      // 0 RGBA tile, 1 mask tile, 2 solid colour
uniform vec4 u_colour;   // premultiplied, for a solid
out vec4 o;
void main() {
  if (u_kind == 2) { o = u_colour; return; }
  vec4 t = texture(u_tex, v_uv);
  if (u_kind == 1) { o = vec4(t.r, t.r, t.r, 1.0); return; }
  o = t;
}`;

const BLEND_LIB = `
float lumOf(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColour(vec3 c) {
  float l = lumOf(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + (c - l) * l / (l - n);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColour(c + (l - lumOf(c))); }
float satOf(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  if (mx <= mn) return vec3(0.0);
  return (c - mn) * s / (mx - mn);
}
float dodge(float b, float s) { if (b <= 0.0) return 0.0; if (s >= 1.0) return 1.0; return min(1.0, b / (1.0 - s)); }
float burn(float b, float s) { if (b >= 1.0) return 1.0; if (s <= 0.0) return 0.0; return 1.0 - min(1.0, (1.0 - b) / s); }
float screenF(float b, float s) { return b + s - b * s; }
float hardLight(float b, float s) { return s <= 0.5 ? b * 2.0 * s : screenF(b, 2.0 * s - 1.0); }
float softLight(float b, float s) {
  if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return b + (2.0 * s - 1.0) * (d - b);
}
float ch(int m, float b, float s) {
  if (m == ${M('darken')}) return min(b, s);
  if (m == ${M('multiply')}) return b * s;
  if (m == ${M('colour-burn')}) return burn(b, s);
  if (m == ${M('linear-burn')}) return clamp(b + s - 1.0, 0.0, 1.0);
  if (m == ${M('lighten')}) return max(b, s);
  if (m == ${M('screen')}) return screenF(b, s);
  if (m == ${M('colour-dodge')}) return dodge(b, s);
  if (m == ${M('linear-dodge')}) return clamp(b + s, 0.0, 1.0);
  if (m == ${M('overlay')}) return hardLight(s, b);
  if (m == ${M('soft-light')}) return softLight(b, s);
  if (m == ${M('hard-light')}) return hardLight(b, s);
  if (m == ${M('vivid-light')}) return s <= 0.5 ? burn(b, 2.0 * s) : dodge(b, 2.0 * (s - 0.5));
  if (m == ${M('linear-light')}) return clamp(b + 2.0 * s - 1.0, 0.0, 1.0);
  if (m == ${M('pin-light')}) return s <= 0.5 ? min(b, 2.0 * s) : max(b, 2.0 * s - 1.0);
  if (m == ${M('hard-mix')}) return b + s >= 1.0 - ${HARD_MIX_GIVE} ? 1.0 : 0.0;
  if (m == ${M('difference')}) return abs(b - s);
  if (m == ${M('exclusion')}) return b + s - 2.0 * b * s;
  if (m == ${M('subtract')}) return clamp(b - s, 0.0, 1.0);
  if (m == ${M('divide')}) return s <= 0.0 ? (b <= 0.0 ? 0.0 : 1.0) : clamp(b / s, 0.0, 1.0);
  return s;
}
vec3 blendRgb(int m, vec3 b, vec3 s) {
  if (m == ${M('hue')}) return setLum(setSat(s, satOf(b)), lumOf(b));
  if (m == ${M('saturation')}) return setLum(setSat(b, satOf(s)), lumOf(b));
  if (m == ${M('colour')}) return setLum(s, lumOf(b));
  if (m == ${M('luminosity')}) return setLum(b, lumOf(s));
  if (m == ${M('darker-colour')}) return lumOf(s) < lumOf(b) ? s : b;
  if (m == ${M('lighter-colour')}) return lumOf(s) > lumOf(b) ? s : b;
  return vec3(ch(m, b.r, s.r), ch(m, b.g, s.g), ch(m, b.b, s.b));
}
// The CPU's dissolve hash (composite.ts dissolveNoise), in unsigned integers.
float dissolveNoise(uint seed, int x, int y) {
  uint h = seed ^ (uint(x) * 374761393u) ^ (uint(y) * 668265263u);
  h = (h ^ (h >> 13u)) * 1274126177u;
  h ^= h >> 16u;
  return float(h) / 4294967296.0;
}
`;

/** One layer's picture blended onto what is under it: source-over, by mode, opacity (and Dissolve). */
export const BLEND_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_photo;
uniform sampler2D u_dst;
uniform sampler2D u_src;
uniform int u_mode;
uniform float u_opacity;
uniform bool u_dissolve;
uniform uint u_seed;
uniform vec4 u_view;     // photo px the target shows
uniform vec2 u_size;     // the target, px
uniform bool u_keepAlpha; // a clipped layer onto its base: the base's alpha stays
out vec4 o;
${BLEND_LIB}
void main() {
  vec4 d = texture(u_dst, v_uv);
  vec4 s = texture(u_src, v_uv);
  float as = s.a * u_opacity;
  if (u_dissolve) {
    vec2 p = u_view.xy + v_photo * u_view.zw;
    float a = s.a * u_opacity;
    as = dissolveNoise(u_seed, int(floor(p.x)), int(floor(p.y))) < a ? 1.0 : 0.0;
  }
  if (as <= 0.0) { o = d; return; }
  vec3 sc = s.a > 0.0 ? s.rgb / s.a : vec3(0.0);
  float ab = d.a;
  vec3 bc = ab > 0.0 ? d.rgb / ab : vec3(0.0);
  vec3 m = sc;
  bool normal = u_mode == ${M('normal')} || u_mode == ${M('dissolve')} || u_mode == ${M('pass-through')};
  if (ab > 0.0 && !normal) m = (1.0 - ab) * sc + ab * blendRgb(u_mode, bc, sc);
  float ao = as + ab * (1.0 - as);
  vec3 co = as * m + (1.0 - as) * ab * bc;
  if (u_keepAlpha) {
    vec3 c = ao > 0.0 ? co / ao : vec3(0.0);
    o = vec4(c * ab, ab);
    return;
  }
  o = vec4(co, ao);
}`;

/** An adjustment layer onto what is under it: colours changed, alpha kept, mixed by mask and opacity. */
export const ADJUST_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 v_uv;
uniform sampler2D u_dst;
uniform int u_form;       // 0 none, 1 channel table, 2 luma table, 3 3D table
uniform sampler2D u_table; // 256 x 1: a channel table (R, G, B) or a luma table (RGB)
uniform sampler3D u_cube;
uniform float u_cubeSize;
uniform sampler2D u_mask;
uniform bool u_hasMask;
uniform float u_opacity;
uniform int u_mode;
out vec4 o;
${BLEND_LIB}
vec3 adjust(vec3 c) {
  if (u_form == 1) {
    vec3 i = (floor(c * 255.0 + 0.5) + 0.5) / 256.0;
    return vec3(texture(u_table, vec2(i.r, 0.5)).r, texture(u_table, vec2(i.g, 0.5)).g, texture(u_table, vec2(i.b, 0.5)).b);
  }
  if (u_form == 2) {
    float l = floor(dot(c, vec3(0.299, 0.587, 0.114)) * 255.0 + 0.5);
    return texture(u_table, vec2((l + 0.5) / 256.0, 0.5)).rgb;
  }
  if (u_form == 3) {
    vec3 at = c * (u_cubeSize - 1.0) / u_cubeSize + 0.5 / u_cubeSize;
    return texture(u_cube, at).rgb;
  }
  return c;
}
void main() {
  vec4 d = texture(u_dst, v_uv);
  if (d.a <= 0.0) { o = d; return; }
  vec3 b = d.rgb / d.a;
  vec3 s = adjust(b);
  bool normal = u_mode == ${M('normal')} || u_mode == ${M('dissolve')} || u_mode == ${M('pass-through')};
  if (!normal) s = blendRgb(u_mode, b, s);
  float k = u_opacity * (u_hasMask ? texture(u_mask, v_uv).r : 1.0);
  vec3 c = mix(b, s, k);
  o = vec4(c * d.a, d.a);
}`;

/** A buffer's alpha (and so its colours) times a mask buffer. */
export const MASK_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform sampler2D u_mask;
out vec4 o;
void main() { o = texture(u_src, v_uv) * texture(u_mask, v_uv).r; }`;

/** A pass-through group's result mixed back by its opacity and mask. */
export const LERP_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform sampler2D u_mask;
uniform bool u_hasMask;
uniform float u_k;
out vec4 o;
void main() {
  float k = u_k * (u_hasMask ? texture(u_mask, v_uv).r : 1.0);
  o = mix(texture(u_a, v_uv), texture(u_b, v_uv), k);
}`;

/** The composite to the screen, over the transparency checkerboard, with the pixel grid when close. */
export const PRESENT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_photo;
uniform sampler2D u_src;
uniform vec2 u_size;       // the canvas, device px
uniform float u_checker;   // a checker square, device px
uniform vec3 u_light;
uniform vec3 u_dark;
uniform vec4 u_view;       // photo px shown
uniform float u_grid;      // the pixel grid's strength (0 off)
out vec4 o;
void main() {
  vec4 c = texture(u_src, v_uv);
  vec2 px = v_uv * u_size;
  vec2 cell = floor(px / u_checker);
  vec3 board = mod(cell.x + cell.y, 2.0) < 1.0 ? u_light : u_dark;
  vec3 col = c.rgb + board * (1.0 - c.a);
  if (u_grid > 0.0) {
    vec2 p = u_view.xy + v_photo * u_view.zw;
    vec2 f = fract(p);
    vec2 w = fwidth(p);
    float line = max(step(f.x, w.x), step(f.y, w.y));
    col = mix(col, vec3(0.5), line * u_grid);
  }
  o = vec4(col, 1.0);
}`;
