// The GPU compositor's shader programs (gl-compositor.ts), compiled and linked once per context, each with its
// uniforms' locations looked up as it is made.
import {
  ADJUST_FS,
  BLEND_FS,
  FULL_VS,
  LERP_FS,
  MASK_FS,
  PRESENT_FS,
  QUAD_VS,
  TILE_FS,
} from './shaders';

export type Program = { p: WebGLProgram; u: Map<string, WebGLUniformLocation | null> };
export type ProgramName = 'tile' | 'blend' | 'adjust' | 'mask' | 'lerp' | 'present';

/** Every pass's program, built on `gl`; a shader that fails to compile or link throws. */
export function compilePrograms(gl: WebGL2RenderingContext): Record<ProgramName, Program> {
  const make = (vs: string, fs: string, names: string[]): Program => {
    const p = gl.createProgram();
    for (const [type, src] of [
      [gl.VERTEX_SHADER, vs],
      [gl.FRAGMENT_SHADER, fs],
    ] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(`program: ${gl.getProgramInfoLog(p)}`);
    return { p, u: new Map(names.map((n) => [n, gl.getUniformLocation(p, n)])) };
  };
  return {
    tile: make(QUAD_VS, TILE_FS, ['u_rect', 'u_view', 'u_tex', 'u_kind', 'u_colour']),
    blend: make(FULL_VS, BLEND_FS, [
      'u_dst',
      'u_src',
      'u_mode',
      'u_opacity',
      'u_dissolve',
      'u_seed',
      'u_view',
      'u_size',
      'u_keepAlpha',
    ]),
    adjust: make(FULL_VS, ADJUST_FS, [
      'u_dst',
      'u_form',
      'u_table',
      'u_cube',
      'u_cubeSize',
      'u_mask',
      'u_hasMask',
      'u_opacity',
      'u_mode',
    ]),
    mask: make(FULL_VS, MASK_FS, ['u_src', 'u_mask']),
    lerp: make(FULL_VS, LERP_FS, ['u_a', 'u_b', 'u_mask', 'u_hasMask', 'u_k']),
    present: make(FULL_VS, PRESENT_FS, [
      'u_src',
      'u_size',
      'u_checker',
      'u_light',
      'u_dark',
      'u_view',
      'u_grid',
    ]),
  };
}
