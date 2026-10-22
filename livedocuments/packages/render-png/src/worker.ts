// The module shapes wrangler hands these imports, declared once here so every Worker that imports this file typechecks
// it without a declaration of its own. Ambient wildcard modules cannot be imported, so a reference it is.
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./worker-modules.d.ts" />
// The renderer as a Cloudflare Worker loads it: wrangler bundles the wasm as a compiled module and the fonts (Inter
// Regular and Bold, OFL) as raw bytes, so a Worker that imports this needs the `Data` rule for `**/*.ttf` and
// `**/*.otf` in its wrangler.toml. One renderer for every Worker that draws PNGs (the MCP server's previews, the api's
// share card), so the two never load the font differently.
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interFont from '../fonts/Inter-Regular.ttf';
import interBold from '../fonts/Inter-Bold.otf';
import { createPngRenderer } from './index';

export const workerPngRenderer = createPngRenderer({
  wasm: async () => resvgWasm,
  font: async () => new Uint8Array(interFont),
  bold: async () => new Uint8Array(interBold),
});
