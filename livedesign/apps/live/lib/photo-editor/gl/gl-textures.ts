// The GPU compositor's textures (gl-compositor.ts): its buffers, the photo's tiles as they upload, and an
// adjustment layer's baked table. Each makes or fills one texture; the compositor keeps and reuses them.
import { bake3dLut, LUT3D_SIZE, PHOTO_TILE, type AdjustmentForm } from '@livedesign/photo-engine';

export type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

/** A `w` x `h` buffer to draw into: half floats where the context renders to them, else bytes. */
export function createTarget(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  float: boolean,
): Target {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fb, tex, w, h };
}

/** One tile's pixels (colours, or a mask's grey) uploaded into `tex`, mipmapped. */
export function uploadTile(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  data: Uint8ClampedArray,
  channels: 1 | 4,
): void {
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
}

/** An adjustment's table as a texture: a 256 x 1 strip for a channel or luma map, else a 3D cube. */
export function bakeTable(
  gl: WebGL2RenderingContext,
  form: Exclude<AdjustmentForm, { kind: 'identity' | 'neighbourhood' }>,
): { tex: WebGLTexture; cube: boolean } {
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
  return { tex, cube };
}
