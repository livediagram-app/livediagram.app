// Headless SVG -> PNG rasterisation for inline MCP image content (docs/specs/015-api/mcp-server.md §5), through
// the shared renderer (@livediagram/render-png). The SVG comes from the shared renderElementsToSvg in
// packages/document, so the MCP, the CLI and the in-app export draw the canvas identically. wrangler bundles the
// wasm as a compiled module and the fonts (Inter Regular and Bold, OFL) as raw bytes.
import { bytesToBase64 } from '@livediagram/api-schema';
import { createPngRenderer } from '@livediagram/render-png';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interFont from '@livediagram/render-png/fonts/Inter-Regular.ttf';
import interBold from '@livediagram/render-png/fonts/Inter-Bold.otf';
import { PREVIEW_MAX_SIDE_PX } from './preview-budget';

const renderer = createPngRenderer({
  wasm: async () => resvgWasm,
  font: async () => new Uint8Array(interFont),
  bold: async () => new Uint8Array(interBold),
});

export async function svgToPngBase64(
  svg: string,
  // The faces the drawing uses beyond Inter (preview-fonts.ts), when they could be fetched.
  fonts: readonly Uint8Array[] = [],
): Promise<string> {
  const { png } = await renderer.renderPng(svg, 1, PREVIEW_MAX_SIDE_PX, fonts);
  return bytesToBase64(png);
}
