// The typefaces a preview draws in (docs/specs/015-api/mcp-server.md §5 "Fonts"): @liveworkspace/mcp-kit's fetch and
// cache, over this product's font table.
import { DISPLAY_FONTS, FONTS } from '@livedesign/design';
import { previewFonts as previewFontsOf, type Fetcher } from '@liveworkspace/mcp-kit/preview-fonts';

export { cached, INTER_ITALIC, type Fetcher } from '@liveworkspace/mcp-kit/preview-fonts';

// The eleven, then a logo page's display faces (docs/specs/004-interface-design/fonts.md "The display library").
const PREVIEW_FONT_TABLE = [...FONTS, ...DISPLAY_FONTS];

// The faces of `fontIds` (this editor's font ids, and INTER_ITALIC) other than Inter, as font files.
export function previewFonts(fontIds: readonly string[], fetcher?: Fetcher): Promise<Uint8Array[]> {
  return previewFontsOf(fontIds, PREVIEW_FONT_TABLE, fetcher);
}
