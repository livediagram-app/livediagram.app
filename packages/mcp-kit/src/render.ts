// Headless SVG -> PNG rasterisation for every product's inline MCP image content (each product's
// docs/specs/015-api/mcp-server.md §5), through the shared Worker renderer (@liveworkspace/render-png/worker, which
// bundles the wasm and the Inter fonts). The SVG comes from the product's own renderElementsToSvg, so its MCP, its
// CLI and its in-app export draw the canvas identically.
import { bytesToBase64 } from '@liveworkspace/api-kit/bytes';
import { workerPngRenderer as renderer } from '@liveworkspace/render-png/worker';
import { PREVIEW_MAX_SIDE_PX } from './preview-budget';

export async function svgToPngBase64(
  svg: string,
  // The faces the drawing uses beyond Inter (preview-fonts.ts), when they could be fetched.
  fonts: readonly Uint8Array[] = [],
): Promise<string> {
  const { png } = await renderer.renderPng(svg, 1, PREVIEW_MAX_SIDE_PX, fonts);
  return bytesToBase64(png);
}
