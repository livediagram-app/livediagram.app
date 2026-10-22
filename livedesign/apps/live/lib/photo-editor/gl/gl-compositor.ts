// The GPU compositor (docs/specs/031-photo/blueprints/photo-engine.md "The GPU compositor"): the
// visible part of a photo drawn at the screen's resolution, every layer's tiles as textures (uploaded
// when they change), each layer drawn into a buffer and blended onto what is under it by its mode,
// adjustment layers run from their baked tables, groups composited in buffers of their own. WebGL 2;
// where it is missing or lost, the CPU view draws instead (cpu-view.ts).
import {
  adjustmentForm,
  bake3dLut,
  hexToBytes,
  layerTree,
  dissolveSeed,
  LUT3D_SIZE,
  PHOTO_TILE,
  TiledRaster,
  type AdjustmentForm,
  type Photo,
  type PhotoLayer,
  type PixelsLookup,
} from '@livedesign/photo-engine';
import {
  ADJUST_FS,
  BLEND_FS,
  FULL_VS,
  LERP_FS,
  MASK_FS,
  modeIndex,
  PRESENT_FS,
  QUAD_VS,
  TILE_FS,
} from './shaders';

type Node = { layer: PhotoLayer; children: Node[] };
export type ViewRect = { x: number; y: number; width: number; height: number };

/** Pictures the CPU draws for the GPU: a fill, a text layer, a layer with effects. */
export type ContentSource = (layer: PhotoLayer) => TiledRaster | null;

type Program = { p: WebGLProgram; u: Map<string, WebGLUniformLocation | null> };
type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

// The GPU memory the tile textures may take before the least recently drawn go.
export const GPU_TILE_BYTES_DESKTOP = 768 * 1024 * 1024;
export const GPU_TILE_BYTES_COARSE = 192 * 1024 * 1024;

// What a texture painted over since its upload is marked as, so the next draw uploads it again.
const STALE = new Uint8ClampedArray(0);

// From this many device px a photo px, the photo's pixels are drawn with hard edges.
export const HARD_EDGES_FROM = 4;

// The adjust pass's texture units: its picture on 0, then a unit each for its tables and its mask.
const ADJUST_UNITS = { table: 1, cube: 2, mask: 3 } as const;
export class GlCompositor {
  readonly gl: WebGL2RenderingContext;
  private readonly progs: Record<
    'tile' | 'blend' | 'adjust' | 'mask' | 'lerp' | 'present',
    Program
  >;
  private readonly quad: WebGLBuffer;
  private readonly vao: WebGLVertexArrayObject;
  private pool: Target[] = [];
  private size = { w: 1, h: 1 };
  // Tile textures by raster key and tile key, with what they were uploaded from.
  private readonly tiles = new Map<
    string,
    Map<string, { tex: WebGLTexture; from: Uint8ClampedArray; used: number }>
  >();
  private tileBytes = 0;
  private readonly tileBudget: number;
  private frame = 0;
  private readonly tables = new Map<string, { tex: WebGLTexture; cube: boolean; key: string }>();
  private readonly float: boolean;
  lost = false;
  // Given up on purpose (dispose): its context loss is ours, not the browser's, and says nothing.
  private disposed = false;
  // 1 x 1 stand-ins bound where a pass's sampler goes unused: a unit left holding an earlier pass's
  // buffer, now this pass's target, is a feedback loop, and WebGL refuses the draw.
  private readonly blank2d: WebGLTexture;
  private readonly blank3d: WebGLTexture;

  constructor(canvas: HTMLCanvasElement, tileBudget = GPU_TILE_BYTES_DESKTOP) {
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: true,
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl;
    this.tileBudget = tileBudget;
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      if (!this.disposed) console.warn('[photo] gl-lost');
    });
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
    this.progs = {
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
    this.blank2d = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.blank2d);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.blank3d = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, this.blank3d);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.quad = gl.createBuffer()!;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  // ---- buffers ----

  private target(): Target {
    const t = this.pool.pop();
    if (t && t.w === this.size.w && t.h === this.size.h) {
      this.clear(t);
      return t;
    }
    if (t) this.free(t);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.float)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        this.size.w,
        this.size.h,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        null,
      );
    else
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        this.size.w,
        this.size.h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const out = { fb, tex, w: this.size.w, h: this.size.h };
    this.clear(out);
    return out;
  }

  private clear(t: Target, r = 0, g = 0, b = 0, a = 0): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private release(t: Target): void {
    this.pool.push(t);
  }

  private free(t: Target): void {
    this.gl.deleteFramebuffer(t.fb);
    this.gl.deleteTexture(t.tex);
  }

  // ---- tiles ----

  private tileTexture(
    key: string,
    tileKey: string,
    data: Uint8ClampedArray,
    channels: 1 | 4,
  ): WebGLTexture {
    const gl = this.gl;
    let map = this.tiles.get(key);
    if (!map) {
      map = new Map();
      this.tiles.set(key, map);
    }
    const had = map.get(tileKey);
    if (had && had.from === data) {
      had.used = this.frame;
      return had.tex;
    }
    const tex = had?.tex ?? gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, channels === 4);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (channels === 4)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        PHOTO_TILE,
        PHOTO_TILE,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
    else
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        PHOTO_TILE,
        PHOTO_TILE,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        data,
      );
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (!had) this.tileBytes += PHOTO_TILE * PHOTO_TILE * channels * 1.34;
    map.set(tileKey, { tex, from: data, used: this.frame });
    return tex;
  }

  /** Drops the textures least recently drawn while over budget. */
  private evict(): void {
    if (this.tileBytes <= this.tileBudget) return;
    const all: { key: string; tile: string; used: number }[] = [];
    for (const [key, map] of this.tiles)
      for (const [tile, e] of map) all.push({ key, tile, used: e.used });
    all.sort((a, b) => a.used - b.used);
    for (const e of all) {
      if (this.tileBytes <= this.tileBudget * 0.8) break;
      if (e.used === this.frame) break;
      const map = this.tiles.get(e.key)!;
      this.gl.deleteTexture(map.get(e.tile)!.tex);
      map.delete(e.tile);
      this.tileBytes -= PHOTO_TILE * PHOTO_TILE * 4 * 1.34;
    }
  }

  /** Tiles painted in place: uploaded again on their next draw. */
  invalidate(key: string, tileKeys: readonly string[]): void {
    const map = this.tiles.get(key);
    if (!map) return;
    for (const k of tileKeys) {
      const e = map.get(k);
      if (e) e.from = STALE;
    }
  }

  /** Forgets a raster's textures (a layer gone). */
  forget(key: string): void {
    const map = this.tiles.get(key);
    if (!map) return;
    for (const e of map.values()) this.gl.deleteTexture(e.tex);
    this.tiles.delete(key);
  }

  // ---- passes ----

  private use(name: keyof GlCompositor['progs']): Program {
    const prog = this.progs[name];
    this.gl.useProgram(prog.p);
    this.gl.bindVertexArray(this.vao);
    return prog;
  }

  private bind(
    prog: Program,
    uniform: string,
    unit: number,
    tex: WebGLTexture,
    cube = false,
  ): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(cube ? gl.TEXTURE_3D : gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.u.get(uniform)!, unit);
  }

  private draw(): void {
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /** A raster's visible tiles drawn into `t` (a layer's colours, or a mask's grey). */
  private drawRaster(
    t: Target,
    raster: TiledRaster | undefined,
    key: string,
    offset: { x: number; y: number },
    view: ViewRect,
    channels: 1 | 4,
  ): void {
    if (!raster) return;
    const gl = this.gl;
    const prog = this.use('tile');
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.uniform4f(prog.u.get('u_view')!, view.x, view.y, view.width, view.height);
    gl.enable(gl.BLEND);
    // Tiles never overlap: each simply replaces what is under it (a mask's start is white, below).
    gl.blendFunc(gl.ONE, gl.ZERO);
    const rect = {
      x: view.x - offset.x,
      y: view.y - offset.y,
      width: view.width,
      height: view.height,
    };
    const cleared = new Set(raster.clearedKeys());
    // Past HARD_EDGES_FROM device px a photo px, its pixels drawn with hard edges, not smoothed
    // (photo-pages.md "Navigating").
    const mag = t.w / view.width >= HARD_EDGES_FROM ? gl.NEAREST : gl.LINEAR;
    for (const [col, row] of TiledRaster.tilesIn(rect)) {
      const k = `${col}.${row}`;
      const data = raster.peek(col, row);
      gl.uniform4f(
        prog.u.get('u_rect')!,
        col * PHOTO_TILE + offset.x,
        row * PHOTO_TILE + offset.y,
        PHOTO_TILE,
        PHOTO_TILE,
      );
      if (data) {
        gl.uniform1i(prog.u.get('u_kind')!, channels === 1 ? 1 : 0);
        this.bind(prog, 'u_tex', 0, this.tileTexture(key, k, data, channels));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
      } else if (channels === 1 && cleared.has(k)) {
        gl.uniform1i(prog.u.get('u_kind')!, 2);
        gl.uniform4f(prog.u.get('u_colour')!, 0, 0, 0, 1);
      } else continue;
      this.draw();
    }
    gl.disable(gl.BLEND);
  }

  private solid(
    t: Target,
    view: ViewRect,
    photo: { width: number; height: number },
    rgb: [number, number, number],
  ): void {
    const gl = this.gl;
    const prog = this.use('tile');
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.uniform4f(prog.u.get('u_view')!, view.x, view.y, view.width, view.height);
    gl.uniform4f(prog.u.get('u_rect')!, 0, 0, photo.width, photo.height);
    gl.uniform1i(prog.u.get('u_kind')!, 2);
    gl.uniform4f(prog.u.get('u_colour')!, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1);
    this.draw();
  }

  private maskBuffer(l: PhotoLayer, pixels: PixelsLookup, view: ViewRect): Target | null {
    if (!l.mask || l.mask.enabled === false) return null;
    const m = this.target();
    this.clear(m, 1, 1, 1, 1);
    const at =
      l.mask.linked === false
        ? (l.mask.offset ?? { x: 0, y: 0 })
        : l.layerKind === 'pixel'
          ? (l.offset ?? { x: 0, y: 0 })
          : { x: 0, y: 0 };
    this.drawRaster(m, pixels.mask(l.id), `${l.id}#mask`, at, view, 1);
    return m;
  }

  private masked(t: Target, mask: Target | null): Target {
    if (!mask) return t;
    const out = this.target();
    const prog = this.use('mask');
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, out.fb);
    this.gl.viewport(0, 0, out.w, out.h);
    this.bind(prog, 'u_src', 0, t.tex);
    this.bind(prog, 'u_mask', 1, mask.tex);
    this.draw();
    this.release(t);
    this.release(mask);
    return out;
  }

  private blend(
    dst: Target,
    src: Target,
    l: PhotoLayer,
    view: ViewRect,
    keepAlpha = false,
  ): Target {
    const gl = this.gl;
    const out = this.target();
    const prog = this.use('blend');
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
    gl.viewport(0, 0, out.w, out.h);
    this.bind(prog, 'u_dst', 0, dst.tex);
    this.bind(prog, 'u_src', 1, src.tex);
    const mode = l.blend ?? 'normal';
    gl.uniform1i(prog.u.get('u_mode')!, modeIndex(mode));
    gl.uniform1f(prog.u.get('u_opacity')!, l.opacity ?? 1);
    gl.uniform1i(prog.u.get('u_dissolve')!, mode === 'dissolve' ? 1 : 0);
    gl.uniform1ui(prog.u.get('u_seed')!, dissolveSeed(l.id));
    gl.uniform4f(prog.u.get('u_view')!, view.x, view.y, view.width, view.height);
    gl.uniform2f(prog.u.get('u_size')!, out.w, out.h);
    gl.uniform1i(prog.u.get('u_keepAlpha')!, keepAlpha ? 1 : 0);
    this.draw();
    this.release(dst);
    this.release(src);
    return out;
  }

  private table(
    l: PhotoLayer & { layerKind: 'adjustment' },
    form: AdjustmentForm,
  ): { tex: WebGLTexture; cube: boolean } | null {
    if (form.kind === 'identity' || form.kind === 'neighbourhood') return null;
    const key = JSON.stringify(l.adjustment);
    const had = this.tables.get(l.id);
    if (had && had.key === key) return had;
    const gl = this.gl;
    if (had) gl.deleteTexture(had.tex);
    const tex = gl.createTexture();
    let cube = false;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (form.kind === 'channel-lut' || form.kind === 'luma-map') {
      const data = new Uint8Array(256 * 4);
      for (let i = 0; i < 256; i++) {
        if (form.kind === 'channel-lut') {
          data[i * 4] = form.lut[i]!;
          data[i * 4 + 1] = form.lut[256 + i]!;
          data[i * 4 + 2] = form.lut[512 + i]!;
        } else {
          data[i * 4] = form.map[i * 3]!;
          data[i * 4 + 1] = form.map[i * 3 + 1]!;
          data[i * 4 + 2] = form.map[i * 3 + 2]!;
        }
        data[i * 4 + 3] = 255;
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
      cube = true;
      const data = bake3dLut(form.fn, LUT3D_SIZE);
      gl.bindTexture(gl.TEXTURE_3D, tex);
      gl.texImage3D(
        gl.TEXTURE_3D,
        0,
        gl.RGBA8,
        LUT3D_SIZE,
        LUT3D_SIZE,
        LUT3D_SIZE,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R])
        gl.texParameteri(gl.TEXTURE_3D, w, gl.CLAMP_TO_EDGE);
    }
    const out = { tex, cube, key };
    this.tables.set(l.id, out);
    return out;
  }

  private adjust(
    dst: Target,
    l: PhotoLayer & { layerKind: 'adjustment' },
    pixels: PixelsLookup,
    view: ViewRect,
    forms: Map<string, AdjustmentForm>,
  ): Target {
    let form = forms.get(l.id);
    if (!form) {
      form = adjustmentForm(l.adjustment);
      forms.set(l.id, form);
    }
    const table = this.table(l, form);
    if (!table) return dst;
    const gl = this.gl;
    const mask = this.maskBuffer(l, pixels, view);
    const out = this.target();
    const prog = this.use('adjust');
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
    gl.viewport(0, 0, out.w, out.h);
    this.bind(prog, 'u_dst', 0, dst.tex);
    gl.uniform1i(
      prog.u.get('u_form')!,
      form.kind === 'channel-lut' ? 1 : form.kind === 'luma-map' ? 2 : 3,
    );
    // Every sampler on a unit of its own, used or not, holding a texture of its kind: a sampler3D left on
    // unit 0 beside u_dst's sampler2D, or a unit still holding the buffer drawn into now, fails the draw.
    if (table.cube) {
      this.bind(prog, 'u_cube', ADJUST_UNITS.cube, table.tex, true);
      this.bind(prog, 'u_table', ADJUST_UNITS.table, this.blank2d);
      gl.uniform1f(prog.u.get('u_cubeSize')!, LUT3D_SIZE);
    } else {
      this.bind(prog, 'u_table', ADJUST_UNITS.table, table.tex);
      this.bind(prog, 'u_cube', ADJUST_UNITS.cube, this.blank3d, true);
    }
    this.bind(prog, 'u_mask', ADJUST_UNITS.mask, mask ? mask.tex : this.blank2d);
    gl.uniform1i(prog.u.get('u_hasMask')!, mask ? 1 : 0);
    gl.uniform1f(prog.u.get('u_opacity')!, l.opacity ?? 1);
    gl.uniform1i(prog.u.get('u_mode')!, modeIndex(l.blend ?? 'normal'));
    this.draw();
    this.release(dst);
    if (mask) this.release(mask);
    return out;
  }

  private lerp(a: Target, b: Target, k: number, mask: Target | null): Target {
    const gl = this.gl;
    const out = this.target();
    const prog = this.use('lerp');
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
    gl.viewport(0, 0, out.w, out.h);
    this.bind(prog, 'u_a', 0, a.tex);
    this.bind(prog, 'u_b', 1, b.tex);
    this.bind(prog, 'u_mask', 2, mask ? mask.tex : this.blank2d);
    gl.uniform1i(prog.u.get('u_hasMask')!, mask ? 1 : 0);
    gl.uniform1f(prog.u.get('u_k')!, k);
    this.draw();
    this.release(a);
    this.release(b);
    if (mask) this.release(mask);
    return out;
  }

  private copy(t: Target): Target {
    const out = this.target();
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, out.fb);
    gl.blitFramebuffer(0, 0, t.w, t.h, 0, 0, out.w, out.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    return out;
  }

  // ---- the tree ----

  private content(node: Node, ctx: RenderCtx): Target {
    const l = node.layer;
    const t = this.target();
    if (l.layerKind === 'group') {
      const inner = this.list(node.children, t, ctx);
      return this.masked(inner, this.maskBuffer(l, ctx.pixels, ctx.view));
    }
    if (l.layerKind === 'fill' && l.fill.kind === 'solid') {
      this.solid(t, ctx.view, ctx.photo, hexToBytes(l.fill.colour));
    } else if (l.layerKind === 'pixel' && !ctx.contentOf(l)) {
      this.drawRaster(t, ctx.pixels.layer(l.id), l.id, l.offset ?? { x: 0, y: 0 }, ctx.view, 4);
    } else {
      // A gradient fill, text, or a layer with effects: the CPU's picture of it.
      const drawn = ctx.contentOf(l);
      if (drawn) this.drawRaster(t, drawn, `${l.id}#content`, { x: 0, y: 0 }, ctx.view, 4);
    }
    return this.masked(t, this.maskBuffer(l, ctx.pixels, ctx.view));
  }

  private one(node: Node, acc: Target, ctx: RenderCtx): Target {
    const l = node.layer;
    if (l.layerKind === 'adjustment') return this.adjust(acc, l, ctx.pixels, ctx.view, ctx.forms);
    if (l.layerKind === 'group' && (l.blend ?? 'pass-through') === 'pass-through') {
      const before = this.copy(acc);
      const through = this.list(node.children, acc, ctx);
      const mask = this.maskBuffer(l, ctx.pixels, ctx.view);
      if ((l.opacity ?? 1) >= 1 && !mask) {
        this.release(before);
        return through;
      }
      return this.lerp(before, through, l.opacity ?? 1, mask);
    }
    return this.blend(acc, this.content(node, ctx), l, ctx.view);
  }

  private list(nodes: readonly Node[], acc: Target, ctx: RenderCtx): Target {
    let cur = acc;
    let i = 0;
    while (i < nodes.length) {
      const base = nodes[i]!;
      const clipped: Node[] = [];
      let j = i + 1;
      while (j < nodes.length && nodes[j]!.layer.clip) clipped.push(nodes[j++]!);
      i = j;
      if (base.layer.visible === false) continue;
      if (clipped.length === 0 || base.layer.layerKind === 'adjustment') {
        cur = this.one(base, cur, ctx);
        for (const c of clipped) if (c.layer.visible !== false) cur = this.one(c, cur, ctx);
        continue;
      }
      // Clipped layers blend as a group with their base, its alpha kept.
      let t = this.content(base, ctx);
      for (const c of clipped) {
        if (c.layer.visible === false) continue;
        if (c.layer.layerKind === 'adjustment') {
          t = this.adjust(t, c.layer, ctx.pixels, ctx.view, ctx.forms);
          continue;
        }
        t = this.blend(t, this.content(c, ctx), c.layer, ctx.view, true);
      }
      cur = this.blend(cur, t, { ...base.layer, clip: undefined }, ctx.view);
    }
    return cur;
  }

  /** Draws `view` (photo px) of the photo onto the canvas, its drawing buffer `w` x `h` device px. */
  render(
    photo: Photo,
    pixels: PixelsLookup,
    view: ViewRect,
    w: number,
    h: number,
    opts: {
      contentOf?: ContentSource;
      forms?: Map<string, AdjustmentForm>;
      checker?: number;
      dark?: boolean;
      grid?: number;
      overrides?: ReadonlyMap<string, PhotoLayer>;
    } = {},
  ): void {
    if (this.lost) return;
    const gl = this.gl;
    this.frame++;
    if (w !== this.size.w || h !== this.size.h) {
      for (const t of this.pool) this.free(t);
      this.pool = [];
      this.size = { w, h };
    }
    gl.disable(gl.DEPTH_TEST);
    const layers = opts.overrides
      ? photo.layers.map((l) => opts.overrides!.get(l.id) ?? l)
      : photo.layers;
    const ctx: RenderCtx = {
      photo,
      pixels,
      view,
      contentOf: opts.contentOf ?? (() => null),
      forms: opts.forms ?? new Map<string, AdjustmentForm>(),
    };
    const result = this.list(layerTree(layers), this.target(), ctx);
    // To the screen.
    const prog = this.use('present');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    this.bind(prog, 'u_src', 0, result.tex);
    gl.uniform2f(prog.u.get('u_size')!, w, h);
    gl.uniform1f(prog.u.get('u_checker')!, opts.checker ?? 16);
    const light = opts.dark ? [0x1e / 255, 0x29 / 255, 0x3b / 255] : [1, 1, 1];
    const dark = opts.dark
      ? [0x0f / 255, 0x17 / 255, 0x2a / 255]
      : [0xf1 / 255, 0xf5 / 255, 0xf9 / 255];
    gl.uniform3f(prog.u.get('u_light')!, light[0]!, light[1]!, light[2]!);
    gl.uniform3f(prog.u.get('u_dark')!, dark[0]!, dark[1]!, dark[2]!);
    gl.uniform4f(prog.u.get('u_view')!, view.x, view.y, view.width, view.height);
    gl.uniform1f(prog.u.get('u_grid')!, opts.grid ?? 0);
    this.draw();
    this.release(result);
    this.evict();
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.pool) this.free(t);
    for (const key of [...this.tiles.keys()]) this.forget(key);
    for (const t of this.tables.values()) this.gl.deleteTexture(t.tex);
    this.gl.deleteTexture(this.blank2d);
    this.gl.deleteTexture(this.blank3d);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

type RenderCtx = {
  photo: Photo;
  pixels: PixelsLookup;
  view: ViewRect;
  contentOf: ContentSource;
  forms: Map<string, AdjustmentForm>;
};
