// Headless SVG -> PNG rasterisation for inline MCP image content (docs/specs/015-api/mcp-server.md §5), through
// the shared Worker renderer (@livedocuments/render-png/worker, which bundles the wasm and the Inter fonts). The SVG
// comes from the shared renderElementsToSvg in packages/document, so the MCP, the CLI and the in-app export draw the
// canvas identically.
import { bytesToBase64 } from '@livedocuments/api-schema';
import { workerPngRenderer as renderer } from '@livedocuments/render-png/worker';
import { PREVIEW_MAX_SIDE_PX } from './preview-budget';

export async function svgToPngBase64(
  svg: string,
  // The faces the drawing uses beyond Inter (preview-fonts.ts), when they could be fetched.
  fonts: readonly Uint8Array[] = [],
): Promise<string> {
  const { png } = await renderer.renderPng(svg, 1, PREVIEW_MAX_SIDE_PX, fonts);
  return bytesToBase64(png);
}
