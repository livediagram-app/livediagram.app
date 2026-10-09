// Headless SVG -> PNG rasterisation for inline MCP image content (docs/specs/015-api/mcp-server.md §5), through
// the shared renderer (@livediagram/render-png). The SVG comes from the shared renderElementsToSvg in
// packages/document, so the MCP, the CLI and the in-app export draw the canvas identically. wrangler bundles the
// wasm as a compiled module and the font (Inter, OFL) as raw bytes.
import { bytesToBase64 } from '@livediagram/api-schema';
import { createPngRenderer } from '@livediagram/render-png';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interFont from '@livediagram/render-png/fonts/Inter-Regular.ttf';

const renderer = createPngRenderer({
  wasm: async () => resvgWasm,
  font: async () => new Uint8Array(interFont),
});

// The longest side an inline preview is drawn at: 2048 px holds a large board legibly, while a raw
// render sized to the board's bounds (8000 px measured 586 MB) would exceed a Worker's 128 MB and fail
// the tool call after its write was saved. Safe range: 1024 to 4096.
export const PREVIEW_MAX_SIDE_PX = 2048;

export async function svgToPngBase64(svg: string): Promise<string> {
  const { png } = await renderer.renderPng(svg, 1, PREVIEW_MAX_SIDE_PX);
  return bytesToBase64(png);
}
