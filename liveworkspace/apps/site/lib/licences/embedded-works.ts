import type { EmbeddedWork } from '@liveworkspace/licences/tables';

// The works the bundlers cannot see into, as in every product's table: every emitted binary asset
// must match at least one entry.

const text = (file: string) => [{ label: 'LICENSE', file }];

export const EMBEDDED_WORKS: readonly EmbeddedWork[] = [
  // The media worker's SVG renderer (packages/render-png): resvg 0.34 and its rasteriser, compiled
  // by resvg-js 2.6.2, and the typeface it renders with.
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
  {
    id: 'inter',
    name: 'Inter',
    version: '3.19',
    licence: 'OFL-1.1',
    carrier: 'the media service (font)',
    homepage: 'https://github.com/rsms/inter',
    trigger: { assets: /(^|-)Inter-(Regular\.ttf|Bold\.otf)$/ },
    texts: text('inter-3.19-LICENSE.txt'),
  },
  // The site draws the apps' icons from packages/icons, whose Lucide geometry is vendored source.
  {
    id: 'lucide',
    name: 'Lucide',
    version: '1.52.0',
    licence: 'ISC AND MIT',
    carrier: 'liveworkspace source (icons)',
    homepage: 'https://lucide.dev',
    trigger: { sources: ['../packages/icons/src/lucide.generated.ts'] },
    texts: text('lucide-1.52.0-LICENSE.txt'),
  },
];
