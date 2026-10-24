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

const text = (file: string): TextRef[] => [{ label: 'LICENSE', file }];

export const EMBEDDED_WORKS: readonly EmbeddedWork[] = [
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
  // The typeface the MCP server and the CLI render PNG previews with (packages/render-png/fonts).
  {
    id: 'inter',
    name: 'Inter',
    version: '3.19',
    licence: 'OFL-1.1',
    carrier: 'the MCP server and the CLI (font)',
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
    trigger: { sources: ['../packages/icons/src/lucide.generated.ts'] },
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
