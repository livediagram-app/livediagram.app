// The inline-PNG result helper for the MCP tools (docs/specs/015-api/mcp-server.md §5), split from
// tool-helpers.ts: this file reaches the resvg WASM renderer, which cannot load in the plain-node test
// environment, and importing it dragged the auth guard and the plain result
// shapes down with it. They are render-free and unit-tested now; everything
// that genuinely needs a rasteriser lives here.

import { embedTabImages, type ComponentsResponse } from '@livedesign/api-schema';
import {
  componentRefIds,
  expandInstances,
  exportFontIds,
  isValidDesignComponent,
  libraryLookup,
  libraryOf,
  photosOf,
  renderElementsToSvg,
  renderPageToSvg,
  renderPagesToSvg,
  type LaidOutPage,
  type Tab,
} from '@livedesign/design';
// Static-import icon resolver (Worker bundle, size not user-facing) so icon
// elements render their real glyph in the inline image.
// The preview resolvers: an emoji (no emoji font in a Worker) draws from its fetched art, else as a labelled disc,
// never as missing-glyph boxes.
import { previewResolvers } from '@liveworkspace/icons/resolve';
import { emojiGlyphsOf, previewEmoji } from './preview-emoji';
import { svgToPngBase64 } from '@liveworkspace/mcp-kit/render';
import { INTER_ITALIC, previewFonts } from './preview-fonts';
import {
  PREVIEW_PICTURE_LIMITS,
  previewLeftOutNote,
  type PictureLimits,
} from '@liveworkspace/mcp-kit/preview-budget';
import { apiFetch } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { textResult, type StructuredValue, type ToolResult } from './tool-helpers';

// Prefetch the bytes of every image element on the tab and return a
// resolveImageHref that inlines them as data URIs, so the render shows the real
// picture instead of a placeholder (docs/specs/015-api/mcp-server.md §5). resvg (WASM) can't fetch, so
// the bytes must be inlined. Owner-authed via the caller's token — the same
// GET /api/images/:id the app uses. The shared embedder reads them in document
// order within the preview's budget (./preview-budget.ts); any failure
// (missing, too big, past the budget, error) skips that image and the
// placeholder shows; a design with no images does no work. `leftOut` counts
// the pictures a limit kept out, for the preview's note.
type ImageResolver = {
  resolveImageHref?: (imageId: string) => string | undefined;
  leftOut: number;
};

async function buildImageResolver(
  env: Env,
  token: string,
  tab: Tab,
  limits: PictureLimits,
): Promise<ImageResolver> {
  let leftOut = 0;
  const byId = await embedTabImages(
    tab,
    async (id) => {
      const res = await apiFetch(env, token, `/images/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return { bytes: await res.arrayBuffer(), contentType: res.headers.get('Content-Type') };
    },
    {
      ...limits,
      onOverLimit: () => {
        leftOut += 1;
      },
    },
  );
  return {
    ...(byId.size > 0 ? { resolveImageHref: (imageId: string) => byId.get(imageId) } : {}),
    leftOut,
  };
}

// `auth` (env + the caller's token) enables real image embedding; omit it to
// render placeholders for image elements (the pre-embedding behaviour).
type ImageBlock = { type: 'image'; data: string; mimeType: string };
type TextBlock = { type: 'text'; text: string };

// The preview's blocks: the picture, after a note when the budget drew some pictures as placeholders.
const previewBlocks = (image: ImageBlock, leftOut: number): (TextBlock | ImageBlock)[] =>
  leftOut > 0 ? [{ type: 'text', text: previewLeftOutNote(leftOut, 'design') }, image] : [image];
const NO_IMAGES: ImageResolver = { leftOut: 0 };

// What a preview needs to fetch with: the caller's token, and the design for its component mains.
type PreviewAuth = { env: Env; token: string; designId?: string };

// The tab with every instance drawn as its main (docs/specs/015-api/mcp-server.md §4.9e "Previews"): the design's
// mains read once, only when the tab holds an instance. Any failure draws the instances as the renderer's
// placeholder rather than failing the tool.
export async function withMains(tab: Tab, auth?: PreviewAuth): Promise<Tab> {
  if (!auth?.designId || componentRefIds(tab.elements).length === 0) return tab;
  try {
    const res = await apiFetch(
      auth.env,
      auth.token,
      `/designs/${encodeURIComponent(auth.designId)}/components`,
    );
    if (!res.ok) return tab;
    const { components } = await res.json<ComponentsResponse>();
    return expandInstances(
      tab,
      libraryLookup(libraryOf(components.filter(isValidDesignComponent))),
    );
  } catch (err) {
    console.warn('[mcp] preview mains unavailable', { error: String(err) });
    return tab;
  }
}

// A PNG preview of the tab, its images and icons resolved as the editor draws them, after a note when some pictures
// were left out for the budget.
export async function tabPreview(
  given: Tab,
  auth?: PreviewAuth,
  // One page of the tab to draw alone (read_design's `page`); every page when absent.
  page?: LaidOutPage,
): Promise<(TextBlock | ImageBlock)[]> {
  const tab = await withMains(given, auth);
  // Its drawing and its faces are fetched together rather than one after another.
  const [{ svg, leftOut }, fonts] = await Promise.all([
    drawnSvg(tab, auth, page),
    previewFonts(tabFontIds(tab)),
  ]);
  const image: ImageBlock = {
    type: 'image',
    data: await svgToPngBase64(svg, fonts),
    mimeType: 'image/png',
  };
  return previewBlocks(image, leftOut);
}

// How the interactive view draws a page rather than the PNG (view-tab.ts, docs/specs/015-api/mcp-server.md
// "Interactive view (MCP Apps)"): its smaller picture budget, and the shown page's pictures only.
type SvgOptions = { limits?: PictureLimits; pictures?: Tab };

// The tab drawn as its pages (svg-render-pages.ts), as the editor exports them, or one page alone, every instance as
// its main: the PNG's source, and what the interactive view draws. A photo page's composite is never fetched.
export async function tabSvg(
  given: Tab,
  auth?: PreviewAuth,
  page?: LaidOutPage,
  opts: SvgOptions = {},
): Promise<{ svg: string; leftOut: number }> {
  return drawnSvg(await withMains(given, auth), auth, page, opts);
}

// The drawing of a tab whose instances are already expanded, its pictures, icons and emoji resolved as the editor
// draws them. A tab not in Pages draws whole.
async function drawnSvg(
  tab: Tab,
  auth: PreviewAuth | undefined,
  page: LaidOutPage | undefined,
  { limits = PREVIEW_PICTURE_LIMITS, pictures = tab }: SvgOptions = {},
): Promise<{ svg: string; leftOut: number }> {
  const [{ resolveImageHref, leftOut }, emoji] = await Promise.all([
    auth ? buildImageResolver(auth.env, auth.token, pictures, limits) : NO_IMAGES,
    previewEmoji(emojiGlyphsOf(tab.elements)),
  ]);
  const drawWith = { resolveImageHref, ...previewResolvers(emoji) };
  const svg = page
    ? renderPageToSvg(tab, page, drawWith)
    : (renderPagesToSvg(tab, drawWith) ?? renderElementsToSvg(tab, drawWith));
  return { svg, leftOut };
}

// The editor's font ids a tab draws in: its elements' and its own (the fonts a preview fetches beyond Inter), and
// Inter's italics when any text is set in italic.
export function tabFontIds(tab: Tab): string[] {
  return [
    ...exportFontIds(tab.elements, tab.font, tab.finish),
    ...(usesItalic(tab.elements) ? [INTER_ITALIC] : []),
  ];
}

// Whether any text is set in italic: an element's or a line's own, or a run's inside it.
function usesItalic(elements: Tab['elements']): boolean {
  return elements.some(
    (el) =>
      (el as { textItalic?: boolean }).textItalic === true ||
      /"italic":true/.test(JSON.stringify(el)),
  );
}

// `notes` are short text blocks after the structured result, such as the lint summary line.
export async function imageResult(
  value: StructuredValue,
  tab: Tab,
  auth?: PreviewAuth,
  notes: readonly string[] = [],
): Promise<ToolResult> {
  // The structured result (and its text form) first, then the notes, then the preview.
  const result = textResult(value);
  const texts = notes.map((text) => ({ type: 'text' as const, text }));
  // A tab with nothing on it yet answers no picture: a blank page told the caller nothing, and a blank slide's
  // gradient was a 120 KB picture on the first call of every deck (mcp-server.md §5 "An empty tab").
  if (tab.elements.length === 0 && Object.keys(photosOf(tab)).length === 0)
    return {
      ...result,
      content: [...result.content, ...texts, { type: 'text', text: EMPTY_TAB_NOTE }],
    };
  const preview = await tabPreview(tab, auth);
  return { ...result, content: [...result.content, ...texts, ...preview] };
}

export const EMPTY_TAB_NOTE = 'No preview: the tab has nothing on it yet.';
