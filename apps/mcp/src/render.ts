// Headless SVG -> PNG rasterisation for inline MCP image content (spec/62 §5).
// resvg runs as WASM in the Workers runtime; the SVG comes from the shared
// renderElementsToSvg in packages/diagram, so the MCP and the in-app export draw
// diagrams identically.
//
// v1 limitation (spec/62 §5 follow-up): the Workers runtime has no system fonts
// and we don't yet embed a font buffer, so shape / arrow / colour geometry
// rasterises but text labels may not appear in the PNG. The structured
// `elements` returned alongside the image always carry the labels, and
// embedding a font here is the documented next step.
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

// initWasm must run once per isolate; cache the promise so concurrent renders
// share a single initialisation.
let _init: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!_init) _init = initWasm(resvgWasm);
  return _init;
}

export async function svgToPngBase64(svg: string): Promise<string> {
  await ensureWasm();
  const resvg = new Resvg(svg, {
    // No system fonts in Workers; skip the (failing, slow) load attempt.
    font: { fontBuffers: [], loadSystemFonts: false, defaultFontFamily: 'sans-serif' },
  });
  const png = resvg.render().asPng();
  let bin = '';
  for (let i = 0; i < png.length; i++) bin += String.fromCharCode(png[i]!);
  return btoa(bin);
}
