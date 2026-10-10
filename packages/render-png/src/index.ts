// SVG to PNG with resvg (WebAssembly), for every front door that shows a drawing as a picture
// (docs/specs/015-api/blueprints/cli.md "render-png"): the MCP server's inline previews and the CLI's
// `tab render`, `graph render` and `export --format png`. Each front door says how to load the wasm and the
// font: a Worker imports them as modules, Node reads them from beside its bundle, and only when it renders.
//
// Inter is the one font and the default for every family: resvg has no system fonts in a Worker and must not
// read them in Node, or the same drawing would come out differently on every machine. Without a font buffer it
// would draw no text at all.

import { initWasm, Resvg } from '@resvg/resvg-wasm';

export type PngLoaders = {
  wasm: () => Promise<WebAssembly.Module | ArrayBuffer | Uint8Array>;
  font: () => Promise<Uint8Array | ArrayBuffer>;
};

export type RenderedPng = { png: Uint8Array; width: number; height: number };

export const PNG_FONT_FAMILY = 'Inter';

// resvg's wasm initialises once per process, whichever renderer asks first; asking twice throws.
let wasmReady: Promise<void> | null = null;

function ensureWasm(load: PngLoaders['wasm']): Promise<void> {
  wasmReady ??= load().then((module) => initWasm(module));
  // A failed load is retried by the next render rather than cached as broken.
  wasmReady.catch(() => (wasmReady = null));
  return wasmReady;
}

export function createPngRenderer(loaders: PngLoaders): {
  /** `maxSide` bounds the picture's longer side in px (an inline preview in a memory-capped Worker): a
   *  bigger drawing is drawn smaller rather than allocating a pixel buffer the Worker cannot hold. */
  renderPng(svg: string, scale?: number, maxSide?: number): Promise<RenderedPng>;
} {
  let font: Promise<Uint8Array> | null = null;
  return {
    async renderPng(svg, scale = 1, maxSide) {
      await ensureWasm(loaders.wasm);
      font ??= loaders.font().then((bytes) => new Uint8Array(bytes));
      const options = {
        font: {
          fontBuffers: [await font],
          loadSystemFonts: false,
          defaultFontFamily: PNG_FONT_FAMILY,
        },
      };
      const at = (zoom: number) =>
        new Resvg(svg, zoom === 1 ? options : { ...options, fitTo: { mode: 'zoom', value: zoom } });
      let resvg = at(scale);
      // The SVG's own size (resvg's width / height, before any zoom) is known once parsed; drawn past the
      // bound, it is parsed again at the zoom that fits.
      const side = Math.max(resvg.width, resvg.height);
      if (maxSide !== undefined && side * scale > maxSide) {
        resvg.free();
        resvg = at(maxSide / side);
      }
      const image = resvg.render();
      const result = { png: image.asPng(), width: image.width, height: image.height };
      image.free();
      resvg.free();
      return result;
    },
  };
}
