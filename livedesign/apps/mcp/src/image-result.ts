// The inline-PNG result helper for the MCP tools (docs/specs/015-api/mcp-server.md §5), split from
// tool-helpers.ts: this file reaches the resvg WASM renderer, which cannot load in the plain-node test
// environment, and importing it dragged the auth guard and the plain result
// shapes down with it. They are render-free and unit-tested now; everything
// that genuinely needs a rasteriser lives here.

import { embedTabImages } from '@livedesign/api-schema';
import {
  exportFontIds,
  renderPageToSvg,
  renderPagesToSvg,
  type LaidOutPage,
  type Tab,
} from '@livedesign/document';
// Static-import icon resolver (Worker bundle, size not user-facing) so icon
// elements render their real glyph in the inline image.
// The preview resolvers: an emoji (no emoji font in a Worker) draws from its fetched art, else as a labelled disc,
// never as missing-glyph boxes.
import { previewResolvers } from '@livedesign/icons/resolve';
import { emojiGlyphsOf, previewEmoji } from './preview-emoji';
import { svgToPngBase64 } from './render';
import { INTER_ITALIC, previewFonts } from './preview-fonts';
import {
  PREVIEW_IMAGE_BUDGET_BYTES,
  PREVIEW_IMAGE_BUDGET_PIXELS,
  PREVIEW_IMAGE_MAX_BYTES,
  previewLeftOutNote,
} from './preview-budget';
import { apiFetch } from './api';
import type { Env } from './env';
import { textResult, type StructuredValue, type ToolResult } from './tool-helpers';

// Prefetch the bytes of every image element on the tab and return a
// resolveImageHref that inlines them as data URIs, so the render shows the real
// picture instead of a placeholder (docs/specs/015-api/mcp-server.md §5). resvg (WASM) can't fetch, so
// the bytes must be inlined. Owner-authed via the caller's token — the same
// GET /api/images/:id the app uses. The shared embedder reads them in document
// order within the preview's budget (./preview-budget.ts); any failure
// (missing, too big, past the budget, error) skips that image and the
// placeholder shows; a document with no images does no work. `leftOut` counts
// the pictures a limit kept out, for the preview's note.
type ImageResolver = {
  resolveImageHref?: (imageId: string) => string | undefined;
  leftOut: number;
};

async function buildImageResolver(env: Env, token: string, tab: Tab): Promise<ImageResolver> {
  let leftOut = 0;
  const byId = await embedTabImages(
    tab,
    async (id) => {
      const res = await apiFetch(env, token, `/images/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return { bytes: await res.arrayBuffer(), contentType: res.headers.get('Content-Type') };
    },
    {
      maxBytesPerImage: PREVIEW_IMAGE_MAX_BYTES,
      totalBudgetBytes: PREVIEW_IMAGE_BUDGET_BYTES,
      totalBudgetPixels: PREVIEW_IMAGE_BUDGET_PIXELS,
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
  leftOut > 0 ? [{ type: 'text', text: previewLeftOutNote(leftOut) }, image] : [image];
const NO_IMAGES: ImageResolver = { leftOut: 0 };

// A PNG preview of the tab, its images and icons resolved as the editor draws them, after a note when some pictures
// were left out for the budget.
export async function tabPreview(
  tab: Tab,
  auth?: { env: Env; token: string },
  // One page of the tab to draw alone (read_document's `page`); every page when absent.
  page?: LaidOutPage,
): Promise<(TextBlock | ImageBlock)[]> {
  // A tab draws as its pages (svg-render-pages.ts), as the editor exports them. Its pictures and its faces are
  // fetched together rather than one after another.
  const [{ resolveImageHref, leftOut }, fonts, emoji] = await Promise.all([
    auth ? buildImageResolver(auth.env, auth.token, tab) : NO_IMAGES,
    previewFonts(tabFontIds(tab)),
    previewEmoji(emojiGlyphsOf(tab.elements)),
  ]);
  const drawWith = { resolveImageHref, ...previewResolvers(emoji) };
  // Every tab has at least one page, so the pages always draw.
  const svg = page ? renderPageToSvg(tab, page, drawWith) : renderPagesToSvg(tab, drawWith)!;
  const image: ImageBlock = {
    type: 'image',
    data: await svgToPngBase64(svg, fonts),
    mimeType: 'image/png',
  };
  return previewBlocks(image, leftOut);
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
  auth?: { env: Env; token: string },
  notes: readonly string[] = [],
): Promise<ToolResult> {
  // The structured result (and its text form) first, then the notes, then the preview.
  const result = textResult(value);
  const texts = notes.map((text) => ({ type: 'text' as const, text }));
  const preview = await tabPreview(tab, auth);
  return { ...result, content: [...result.content, ...texts, ...preview] };
}
