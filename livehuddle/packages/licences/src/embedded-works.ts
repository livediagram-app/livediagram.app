import type { EmbeddedWork } from '@liveworkspace/licences/tables';
import type { TextRef } from '@liveworkspace/licences/texts';

// The works this product's bundlers cannot see into (docs/specs/002-project-scope/third-party-licences.md
// "What counts as shipped"). Every emitted binary asset must match at least one entry.

const WEBP_WASM = /^webp_(enc|dec)(_simd)?\.[\w-]+\.wasm$/;

const text = (file: string): TextRef[] => [{ label: 'LICENSE', file }];

export const EMBEDDED_WORKS: readonly EmbeddedWork[] = [
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
  // The runtime Emscripten compiles into that module. Its licence
  // text has not changed across the 3.x releases they were built with.
  {
    id: 'emscripten',
    name: 'Emscripten runtime',
    version: '3.x',
    licence: 'MIT OR NCSA',
    carrier: 'WebAssembly modules compiled with Emscripten',
    homepage: 'https://github.com/emscripten-core/emscripten',
    trigger: { assets: WEBP_WASM },
    texts: text('emscripten-3.1.28-LICENSE.txt'),
  },
  // An SVG renderer a Worker may bundle: resvg 0.34 and its rasteriser, compiled by resvg-js 2.6.2. No livehuddle
  // app bundles it since the MCP server went, so the page lists it only if one does again.
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
  // The typeface PNG previews render with (packages/render-png/fonts), listed only when an app bundles it.
  {
    id: 'inter',
    name: 'Inter',
    version: '3.19',
    licence: 'OFL-1.1',
    carrier: 'PNG previews (font)',
    homepage: 'https://github.com/rsms/inter',
    trigger: { assets: /(^|-)Inter-(Regular\.ttf|Bold\.otf)$/ },
    texts: text('inter-3.19-LICENSE.txt'),
  },
  // Icon geometry vendored into the monorepo's own source (packages/icons, shared by every product).
  {
    id: 'lucide',
    name: 'Lucide',
    version: '1.52.0',
    licence: 'ISC AND MIT',
    carrier: 'liveworkspace source (icons)',
    homepage: 'https://lucide.dev',
    trigger: { sources: ['../packages/icons/src/lucide/'] },
    texts: text('lucide-1.52.0-LICENSE.txt'),
  },
  {
    id: 'feather',
    name: 'Feather',
    version: '4.29.2',
    licence: 'MIT',
    carrier: 'liveworkspace source (icons)',
    homepage: 'https://feathericons.com',
    trigger: {
      sources: [
        '../packages/icons/src/icon-catalog-1.ts',
        '../packages/icons/src/icon-catalog-2.ts',
        '../packages/icons/src/icon-catalog-3.ts',
      ],
    },
    texts: text('feather-4.29.2-LICENSE.txt'),
  },
];
