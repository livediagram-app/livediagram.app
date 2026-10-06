// The CLI's pictures (docs/specs/015-api/blueprints/cli.md "Previews", CLI30, CLI31): an SVG drawn by the shared
// renderer, written as is or rasterised at scale 1 with @livediagram/render-png, whose wasm and font the CLI reads
// from beside its bundle only when a render runs.

import { createPngRenderer } from '@livediagram/render-png';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';

export type Picture = { path: string; width: number; height: number; bytes: number };

const renderers = new WeakMap<CliIo, ReturnType<typeof createPngRenderer>>();

function rendererFor(io: CliIo) {
  let renderer = renderers.get(io);
  if (!renderer) {
    const read = (name: Parameters<CliIo['readAsset']>[0]) =>
      io.readAsset(name).catch((err: unknown) => {
        throw new CliError({
          exit: EXIT.failure,
          code: 'missing_asset',
          message: `${name} is missing beside the CLI: ${String(err)}`,
          hint: 'reinstall: npm install -g livediagram@latest',
        });
      });
    renderer = createPngRenderer({
      wasm: () => read('resvg.wasm'),
      font: () => read('Inter-Regular.ttf'),
    });
    renderers.set(io, renderer);
  }
  return renderer;
}

// The width and height an SVG declares on its root, in pixels.
export function svgSize(svg: string): { width: number; height: number } {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const attr = (name: string) => Number(new RegExp(`\\b${name}="([\\d.]+)`).exec(root)?.[1] ?? 0);
  return { width: Math.round(attr('width')), height: Math.round(attr('height')) };
}

// Writes the drawing as SVG or, for a `.png` path, as a PNG.
export async function writePicture(
  io: CliIo,
  path: string,
  svg: string,
  format: 'svg' | 'png',
): Promise<Picture> {
  if (format === 'svg') {
    await io.files.write(path, svg);
    return { path, ...svgSize(svg), bytes: new TextEncoder().encode(svg).length };
  }
  const { png, width, height } = await rendererFor(io).renderPng(svg);
  await io.files.writeBytes(path, png);
  return { path, width, height, bytes: png.length };
}

// `<path>  <width>×<height> · <n> KB` (CLI30).
export const pictureLine = (p: Picture) =>
  `${p.path}  ${p.width}×${p.height} · ${Math.max(1, Math.round(p.bytes / 1024))} KB`;
