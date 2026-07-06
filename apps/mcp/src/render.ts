// Headless SVG -> PNG rasterisation for inline MCP image content (spec/62 §5).
// resvg runs as WASM in the Workers runtime; the SVG comes from the shared
// renderElementsToSvg in packages/diagram, so the MCP and the in-app export draw
// diagrams identically.
//
// Workers have no system fonts, so we embed one (Inter, OFL — see
// fonts/Inter-OFL.txt) as a font buffer and render every label in it. Without an
// embedded font resvg draws shapes / arrows / colours but no TEXT, leaving every
// label off the PNG. A diagram's own font choice falls back to Inter in the
// preview; the structured elements returned alongside still carry the true font.
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interFont from '../fonts/Inter-Regular.ttf';

const FONT_BUFFER = new Uint8Array(interFont);

// initWasm must run once per isolate; cache the promise so concurrent renders
// share a single initialisation.
let _init: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!_init) _init = initWasm(resvgWasm);
  return _init;
}

// base64-encode raw bytes. Chunked so a large buffer doesn't blow the call
// stack via String.fromCharCode(...spread). Shared by the PNG encoder and the
// image-embedding path (spec/62 §5).
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export async function svgToPngBase64(svg: string): Promise<string> {
  await ensureWasm();
  const resvg = new Resvg(svg, {
    // Embed Inter; skip the (absent, slow) system-font load. Any font-family the
    // SVG requests that isn't Inter falls back to it via defaultFontFamily.
    font: { fontBuffers: [FONT_BUFFER], loadSystemFonts: false, defaultFontFamily: 'Inter' },
  });
  const png = resvg.render().asPng();
  return bytesToBase64(png);
}
