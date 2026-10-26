// SVG to PNG with resvg (WebAssembly), for every front door that shows a drawing as a picture
// (docs/specs/015-api/blueprints/cli.md "render-png"): the MCP server's inline previews and the CLI's
// `tab render`, `graph render` and `export --format png`. Each front door says how to load the wasm and the
// font: a Worker imports them as modules, Node reads them from beside its bundle, and only when it renders.
//
// Inter is the one font and the default for every family: resvg has no system fonts in a Worker and must not
// read them in Node, or the same drawing would come out differently on every machine. Without a font buffer it
// would draw no text at all. Its Bold draws every weight past 500 (a title, a sheet's header row, a total), which
// Regular alone would draw regular.

import { initWasm, Resvg } from '@resvg/resvg-wasm';

export type PngLoaders = {
  wasm: () => Promise<WebAssembly.Module | ArrayBuffer | Uint8Array>;
  font: () => Promise<Uint8Array | ArrayBuffer>;
  bold: () => Promise<Uint8Array | ArrayBuffer>;
};

type RenderedPng = { png: Uint8Array; width: number; height: number };

const PNG_FONT_FAMILY = 'Inter';

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
  renderPng(
    svg: string,
    scale?: number,
    maxSide?: number,
    // More faces for this render (an element's own font, fetched by the caller); Inter draws whatever they lack.
    extraFonts?: readonly Uint8Array[],
  ): Promise<RenderedPng>;
} {
  let fonts: Promise<Uint8Array[]> | null = null;
  return {
    async renderPng(svg, scale = 1, maxSide, extraFonts = []) {
      await ensureWasm(loaders.wasm);
      if (!fonts) {
        const loading = Promise.all([loaders.font(), loaders.bold()]).then((all) =>
          all.map((bytes) => new Uint8Array(bytes)),
        );
        // As with the wasm, a failed load is tried again by the next render rather than kept as broken.
        loading.catch(() => (fonts = null));
        fonts = loading;
      }
      const options = {
        font: {
          fontBuffers: [...(await fonts), ...extraFonts],
          loadSystemFonts: false,
          defaultFontFamily: PNG_FONT_FAMILY,
        },
      };
      const at = (zoom: number) =>
        new Resvg(svg, zoom === 1 ? options : { ...options, fitTo: { mode: 'zoom', value: zoom } });
      let resvg: ReturnType<typeof at> | null = at(scale);
      // Freed whatever happens: the wasm's memory is not the garbage collector's.
      try {
        // The SVG's own size (resvg's width / height, before any zoom) is known once parsed; drawn past the
        // bound, it is parsed again at the zoom that fits.
        const side = Math.max(resvg.width, resvg.height);
        if (maxSide !== undefined && side * scale > maxSide) {
          resvg.free();
          resvg = null;
          resvg = at(maxSide / side);
        }
        const image = resvg.render();
        try {
          return { png: image.asPng(), width: image.width, height: image.height };
        } finally {
          image.free();
        }
      } finally {
        resvg?.free();
      }
    },
  };
}
