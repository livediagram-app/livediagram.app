// The inline-PNG result helper for the MCP tools (docs/specs/015-api/mcp-server.md §5), split from
// tool-helpers.ts: this file reaches the resvg WASM renderer, which cannot load in the plain-node test
// environment, and importing it dragged the auth guard and the plain result
// shapes down with it. They are render-free and unit-tested now; everything
// that genuinely needs a rasteriser lives here.

import type { ItemsResponse, SheetsResponse } from '@livediagram/api-schema';
import { renderModelsForTab, sheetFramesOf } from '@livediagram/sheets';
import {
  cardSourceOf,
  readItemTypeCatalogue,
  typesOf,
  type Item,
  type ItemTypeCatalogue,
  type ItemTypeDef,
} from '@livediagram/items';
import { embedTabImages } from '@livediagram/api-schema';
import {
  canvasSurface,
  exportFontIds,
  planBoardFitHeight,
  renderElementsToSvg,
  type SheetRenderModel,
  type Tab,
} from '@livediagram/document';
import { planTabKindOf } from '@livediagram/plan-art';
// Static-import icon resolver (Worker bundle, size not user-facing) so icon
// elements render their real glyph in the inline image.
// The preview resolvers: an emoji (no emoji font in a Worker) draws from its fetched art, else as a labelled disc,
// never as missing-glyph boxes.
import { previewResolvers } from '@livediagram/icons/resolve';
import { emojiGlyphsOf, previewEmoji } from './preview-emoji';
import { chartsReadLive } from '@livediagram/agent-verbs';
import { svgToPngBase64 } from './render';
import { INTER_ITALIC, previewFonts } from './preview-fonts';
import { planPreviewFor } from './plan-preview';
import { formPreview } from './form-preview';
import { coversAnother } from './board-growth';
import {
  PREVIEW_IMAGE_BUDGET_BYTES,
  PREVIEW_IMAGE_BUDGET_PIXELS,
  PREVIEW_IMAGE_MAX_BYTES,
  previewLeftOutNote,
} from './preview-budget';
import { apiFetch, apiJson } from './api';
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

// A Plan board's or card's items (docs/specs/026-plan/plan-board.md), and a Sheet's window of cells
// (docs/specs/029-sheets/sheet.md "Exports and images"), so a preview draws them; none when the tab has neither, or
// the document is not named. Each read is best-effort: a preview without it still draws.
async function planContentFor(
  tab: Tab,
  auth: { env: Env; token: string; documentId?: string } | undefined,
  read: SheetsResponse['sheets'] | undefined,
): Promise<{
  items?: ReadonlyMap<string, Item>;
  itemTypes?: readonly ItemTypeDef[];
  sheets?: ReadonlyMap<string, SheetRenderModel>;
  // The sheets read, for the charts linked to them to draw what their cells hold now.
  sheetJson?: SheetsResponse['sheets'];
}> {
  // Plan views (metrics, charts) read the cards too, as a Dashboard's do.
  const plan = tab.elements.some(
    (el) =>
      el.type === 'shape' &&
      (el.shape === 'plan-board' || el.shape === 'plan-card' || el.shape === 'plan-view'),
  );
  const frames = sheetFramesOf(tab.elements);
  // A chart linked to a sheet reads it live, framed on this tab or not.
  const charted = tab.elements.flatMap((el) => {
    const source = (el as { chartSource?: { sheetId?: string } }).chartSource;
    return source?.sheetId ? [source.sheetId] : [];
  });
  if ((!plan && frames.length === 0 && charted.length === 0) || !auth?.documentId) return {};
  const path = `/documents/${encodeURIComponent(auth.documentId)}`;
  const ids = [...new Set([...frames.map((f) => f.sheetId), ...charted])].slice(0, 50);
  const sheets = read
    ? { sheets: read }
    : ids.length
      ? await apiJson<SheetsResponse>(
          auth.env,
          auth.token,
          `${path}/sheets?ids=${ids.join(',')}`,
        ).catch(() => null)
      : null;
  const sheetCards = !!sheets?.sheets.some((s) =>
    s.cells.some((c) => c.i && 'f' in c.i && c.i.f.t.includes('CARD')),
  );
  // The items, and the document's item types so custom types keep their colours
  // (docs/specs/026-plan/item-types.md).
  const [items, doc] =
    plan || sheetCards
      ? await Promise.all([
          apiJson<ItemsResponse>(auth.env, auth.token, `${path}/items`).catch(() => null),
          apiJson<{ document?: { itemTypes?: ItemTypeCatalogue | null } }>(
            auth.env,
            auth.token,
            path,
          ).catch(() => null),
        ])
      : [null, null];
  const itemTypes = typesOf(readItemTypeCatalogue(doc?.document?.itemTypes ?? null));
  return {
    ...(items ? { items: new Map(items.items.map((i) => [i.id, i])) } : {}),
    ...(plan ? { itemTypes } : {}),
    ...(sheets ? { sheetJson: sheets.sheets } : {}),
    ...(sheets
      ? {
          sheets: renderModelsForTab(sheets.sheets, frames, {
            cards: sheetCards && items ? cardSourceOf(items.items, itemTypes) : null,
          }),
        }
      : {}),
  };
}

// A PNG preview of the tab, its images and icons resolved as the editor draws them, after a note when some pictures
// were left out for the budget.
export async function tabPreview(
  tab: Tab,
  auth?: { env: Env; token: string; documentId?: string },
): Promise<(TextBlock | ImageBlock)[]> {
  // A Form tab draws as its form, as respondents see it.
  const form = await formPreview(tab);
  if (form) return [form];
  // A Plan tab as the editor exports it: a Dashboard laid out, its pictures drawn from the cards.
  const art = previewResolvers(await previewEmoji(emojiGlyphsOf(tab.elements)));
  const plain = (shown: Tab) => renderElementsToSvg(shown, art);
  const laidOut = await planPreviewFor(tab, auth, plain).catch(() => null);
  const drawn = laidOut?.tab ?? tab;
  const [{ resolveImageHref, leftOut }, content] = await Promise.all([
    auth ? buildImageResolver(auth.env, auth.token, drawn) : NO_IMAGES,
    planContentFor(drawn, auth, laidOut?.sheets),
  ]);
  // A board scrolls on its tab, so its preview grows to every card rather than cutting the rest off ("+2 more", a lane
  // cut away): always on a Board tab, and on any other wherever the grown board covers nothing else on the canvas.
  const boardTab = !!laidOut && planTabKindOf(tab) === 'board';
  const shown = {
    ...drawn,
    elements: drawn.elements.map((el) => {
      if (el.type !== 'shape' || el.shape !== 'plan-board') return el;
      const height = planBoardFitHeight(
        el,
        content.items,
        canvasSurface(drawn.backgroundColor ?? '#ffffff'),
        content.itemTypes,
      );
      if (height <= el.height) return el;
      const grown = { ...el, height };
      return boardTab || !coversAnother(grown, el.y + el.height, drawn.elements) ? grown : el;
    }),
  };
  // Charts linked to a sheet draw what its cells hold now, not what they were saved with.
  const { sheetJson, ...drawWith } = content;
  const live = sheetJson
    ? { ...shown, elements: chartsReadLive(shown.elements, sheetJson) }
    : shown;
  const png = await svgToPngBase64(
    renderElementsToSvg(live, {
      resolveImageHref,
      ...art,
      ...drawWith,
      ...(laidOut ? { resolvePlanArt: laidOut.artWith(content) } : {}),
    }),
    await previewFonts(tabFontIds(live, drawWith.sheets)),
  );
  return previewBlocks({ type: 'image', data: png, mimeType: 'image/png' }, leftOut);
}

// The editor's font ids a tab draws in: its elements' and its own and a sheet's cells' (the fonts a preview fetches
// beyond Inter), and Inter's italics when any text is set in italic.
export function tabFontIds(tab: Tab, sheets?: ReadonlyMap<string, SheetRenderModel>): string[] {
  return [
    ...exportFontIds(tab.elements, tab.font, sheets, tab.finish),
    ...(usesItalic(tab.elements) ? [INTER_ITALIC] : []),
  ];
}

// Whether any text is set in italic: an element's or a line's own, or a run's or a cell's inside it.
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
  // The document the preview's items belong to: the result names it as `id` or `documentId`.
  const named = (value as { id?: unknown; documentId?: unknown }) ?? {};
  const documentId =
    typeof named.documentId === 'string'
      ? named.documentId
      : typeof named.id === 'string'
        ? named.id
        : undefined;
  const preview = await tabPreview(tab, auth && documentId ? { ...auth, documentId } : auth);
  return { ...result, content: [...result.content, ...texts, ...preview] };
}
