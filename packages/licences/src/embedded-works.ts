import type { TextRef } from './texts.ts';

// Material a bundler cannot see into: libraries compiled into an emitted
// WebAssembly binary or font, and third-party geometry vendored into our own
// source (docs/specs/002-project-scope/third-party-licences.md "What counts as
// shipped"). Every emitted binary asset must match at least one entry.
export type EmbeddedWork = {
  id: string;
  name: string;
  version: string;
  licence: string;
  carrier: string;
  homepage: string;
  trigger: { assets: RegExp } | { sources: string[] };
  texts: TextRef[];
};

const TFJS_WASM = /^tfjs-backend-wasm(-simd|-threaded-simd)?\.[\w-]+\.wasm$/;
const ORT_WASM = /^ort-wasm[\w.-]*\.wasm$/;
const WEBP_WASM = /^webp_(enc|dec)(_simd)?\.[\w-]+\.wasm$/;
const TFJS_CARRIER = '@tensorflow/tfjs-backend-wasm (WebAssembly)';

const text = (file: string): TextRef[] => [{ label: 'LICENSE', file }];

export const EMBEDDED_WORKS: readonly EmbeddedWork[] = [
  // The TensorFlow.js WASM backend, built from tfjs-v4.22.0's WORKSPACE.
  {
    id: 'xnnpack',
    name: 'XNNPACK',
    version: '5e8033a',
    licence: 'BSD-3-Clause',
    carrier: TFJS_CARRIER,
    homepage: 'https://github.com/google/XNNPACK',
    trigger: { assets: TFJS_WASM },
    texts: text('xnnpack-5e8033a-LICENSE.txt'),
  },
  {
    id: 'pthreadpool',
    name: 'pthreadpool',
    version: '545ebe9',
    licence: 'BSD-2-Clause',
    carrier: TFJS_CARRIER,
    homepage: 'https://github.com/Maratyszcza/pthreadpool',
    trigger: { assets: TFJS_WASM },
    texts: text('pthreadpool-545ebe9-LICENSE.txt'),
  },
  {
    id: 'cpuinfo',
    name: 'cpuinfo',
    version: 'ed8b86a',
    licence: 'BSD-2-Clause',
    carrier: TFJS_CARRIER,
    homepage: 'https://github.com/pytorch/cpuinfo',
    trigger: { assets: TFJS_WASM },
    texts: text('cpuinfo-ed8b86a-LICENSE.txt'),
  },
  {
    id: 'clog',
    name: 'clog (cpuinfo)',
    version: 'd5e37ad',
    licence: 'BSD-2-Clause',
    carrier: TFJS_CARRIER,
    homepage: 'https://github.com/pytorch/cpuinfo',
    trigger: { assets: TFJS_WASM },
    texts: text('clog-d5e37ad-LICENSE.txt'),
  },
  {
    id: 'fp16',
    name: 'FP16',
    version: '3c54eac',
    licence: 'MIT',
    carrier: TFJS_CARRIER,
    homepage: 'https://github.com/Maratyszcza/FP16',
    trigger: { assets: TFJS_WASM },
    texts: text('fp16-3c54eac-LICENSE.txt'),
  },
  {
    id: 'fxdiv',
    name: 'FXdiv',
    version: 'b408327',
    licence: 'MIT',
    carrier: TFJS_CARRIER,
    homepage: 'https://github.com/Maratyszcza/FXdiv',
    trigger: { assets: TFJS_WASM },
    texts: text('fxdiv-b408327-LICENSE.txt'),
  },
  {
    id: 'psimd',
    name: 'psimd',
    version: '072586a',
    licence: 'MIT',
    carrier: TFJS_CARRIER,
    homepage: 'https://github.com/Maratyszcza/psimd',
    trigger: { assets: TFJS_WASM },
    texts: text('psimd-072586a-LICENSE.txt'),
  },
  // ONNX Runtime's own notices cover the libraries compiled into its WASM; the
  // onnxruntime-web package entry carries only its MIT licence.
  {
    id: 'onnxruntime',
    name: 'ONNX Runtime (WebAssembly)',
    version: '89f8206',
    licence: 'MIT',
    carrier: 'onnxruntime-web (WebAssembly)',
    homepage: 'https://github.com/microsoft/onnxruntime',
    trigger: { assets: ORT_WASM },
    texts: [
      { label: 'LICENSE', file: 'onnxruntime-89f8206ba4-LICENSE.txt' },
      { label: 'ThirdPartyNotices.txt', file: 'onnxruntime-89f8206ba4-ThirdPartyNotices.txt' },
    ],
  },
  // libwebp inside @jsquash/webp, built from libwebp d2e245e (jSquash's codec Makefile).
  {
    id: 'libwebp',
    name: 'libwebp',
    version: 'd2e245e',
    licence: 'BSD-3-Clause',
    carrier: '@jsquash/webp (WebAssembly)',
    homepage: 'https://github.com/webmproject/libwebp',
    trigger: { assets: WEBP_WASM },
    texts: [{ label: 'COPYING', package: '@jsquash/webp', path: 'codec/LICENSE.codec.md' }],
  },
  // The runtime Emscripten compiles into each of those modules. Its licence
  // text has not changed across the 3.x releases they were built with.
  {
    id: 'emscripten',
    name: 'Emscripten runtime',
    version: '3.x',
    licence: 'MIT OR NCSA',
    carrier: 'WebAssembly modules compiled with Emscripten',
    homepage: 'https://github.com/emscripten-core/emscripten',
    trigger: { assets: new RegExp(`${TFJS_WASM.source}|${ORT_WASM.source}|${WEBP_WASM.source}`) },
    texts: text('emscripten-3.1.28-LICENSE.txt'),
  },
  // The mcp worker's SVG renderer: resvg 0.34 and its rasteriser, compiled by resvg-js 2.6.2.
  {
    id: 'resvg',
    name: 'resvg',
    version: '0.34.0',
    licence: 'MPL-2.0',
    carrier: '@resvg/resvg-wasm (WebAssembly)',
    homepage: 'https://github.com/linebender/resvg',
    trigger: { assets: /(^|-)index_bg\.wasm$/ },
    texts: text('resvg-js-2.6.2-LICENSE.txt'),
  },
  {
    id: 'tiny-skia',
    name: 'tiny-skia',
    version: '0.10.0',
    licence: 'BSD-3-Clause',
    carrier: '@resvg/resvg-wasm (WebAssembly)',
    homepage: 'https://github.com/linebender/tiny-skia',
    trigger: { assets: /(^|-)index_bg\.wasm$/ },
    texts: text('tiny-skia-0.10.0-LICENSE.txt'),
  },
  // The typeface the mcp worker renders previews with (apps/mcp/fonts).
  {
    id: 'inter',
    name: 'Inter',
    version: '3.19',
    licence: 'OFL-1.1',
    carrier: 'the MCP server (font)',
    homepage: 'https://github.com/rsms/inter',
    trigger: { assets: /(^|-)Inter-Regular\.ttf$/ },
    texts: text('inter-3.19-LICENSE.txt'),
  },
  // draw.io's view geometry (routes, perimeters, label points) ported into the draw.io importer.
  {
    id: 'drawio-mxgraph',
    name: 'draw.io (mxGraph view geometry)',
    version: '31.7.0',
    licence: 'Apache-2.0',
    carrier: 'livediagram source (draw.io import)',
    homepage: 'https://github.com/jgraph/drawio',
    trigger: {
      sources: [
        'apps/live/lib/drawio/route/edge-styles.ts',
        'apps/live/lib/drawio/route/geometry.ts',
        'apps/live/lib/drawio/route/label.ts',
        'apps/live/lib/drawio/route/orth-connector.ts',
        'apps/live/lib/drawio/route/page.ts',
        'apps/live/lib/drawio/route/perimeters.ts',
        'apps/live/lib/drawio/route/segment-connector.ts',
        'apps/live/lib/drawio/route/state.ts',
        'apps/live/lib/drawio/route/view.ts',
      ],
    },
    texts: text('drawio-31.7.0-LICENSE.txt'),
  },
  // Icon geometry vendored into our own source (packages/icons).
  {
    id: 'lucide',
    name: 'Lucide',
    version: '1.48.0',
    licence: 'ISC AND MIT',
    carrier: 'livediagram source (icons)',
    homepage: 'https://lucide.dev',
    trigger: { sources: ['packages/icons/src/lucide.generated.ts'] },
    texts: text('lucide-1.48.0-LICENSE.txt'),
  },
  {
    id: 'feather',
    name: 'Feather',
    version: '4.29.2',
    licence: 'MIT',
    carrier: 'livediagram source (icons)',
    homepage: 'https://feathericons.com',
    trigger: {
      sources: ['packages/icons/src/icon-catalog-1.ts', 'packages/icons/src/icon-catalog-2.ts'],
    },
    texts: text('feather-4.29.2-LICENSE.txt'),
  },
];
