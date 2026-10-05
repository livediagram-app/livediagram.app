// The inline-PNG result helper for the MCP tools (docs/specs/015-api/mcp-server.md §5), split from
// tool-helpers.ts: this file reaches the resvg WASM renderer, which cannot load in the plain-node test
// environment, and importing it dragged the auth guard and the plain result
// shapes down with it. They are render-free and unit-tested now; everything
// that genuinely needs a rasteriser lives here.

import type { ItemsResponse } from '@livediagram/api-schema';
import {
  readItemTypeCatalogue,
  typesOf,
  type Item,
  type ItemTypeCatalogue,
  type ItemTypeDef,
} from '@livediagram/items';
import { embedTabImages } from '@livediagram/api-schema';
import { renderElementsToSvg, type Tab } from '@livediagram/document';
// Static-import icon resolver (Worker bundle, size not user-facing) so icon
// elements render their real glyph in the inline image.
import { resolveIconExportArt, resolveStickerArt } from '@livediagram/icons/resolve';
import { svgToPngBase64 } from './render';
import { apiFetch, apiJson } from './api';
import type { Env } from './env';
import { textResult, type StructuredValue, type ToolResult } from './tool-helpers';

// Per-image cap for embedding (docs/specs/015-api/mcp-server.md §5): a document can reference large
// uploads, and inlining them as base64 into the preview PNG's own base64
// response would bloat what the model receives. Above this, the image falls
// back to the placeholder box (as before) — the structured elements still carry
// its id.
const MAX_EMBED_BYTES = 2 * 1024 * 1024;

// Prefetch the bytes of every image element on the tab and return a
// resolveImageHref that inlines them as data URIs, so the render shows the real
// picture instead of a placeholder (docs/specs/015-api/mcp-server.md §5). resvg (WASM) can't fetch, so
// the bytes must be inlined. Owner-authed via the caller's token — the same
// GET /api/images/:id the app uses. The shared embedder reads them
// concurrently under the per-image cap; any failure (missing, too big, error)
// skips that image and the placeholder shows; a document with no images does no
// work.
async function buildImageResolver(
  env: Env,
  token: string,
  tab: Tab,
): Promise<((imageId: string) => string | undefined) | undefined> {
  const byId = await embedTabImages(
    tab,
    async (id) => {
      const res = await apiFetch(env, token, `/images/${id}`);
      if (!res.ok) return null;
      return { bytes: await res.arrayBuffer(), contentType: res.headers.get('Content-Type') };
    },
    { maxBytesPerImage: MAX_EMBED_BYTES },
  );
  return byId.size > 0 ? (imageId: string) => byId.get(imageId) : undefined;
}

// `auth` (env + the caller's token) enables real image embedding; omit it to
// render placeholders for image elements (the pre-embedding behaviour).
export type ImageBlock = { type: 'image'; data: string; mimeType: string };

// A Plan board's or card's items (docs/specs/025-plan/plan-board.md), so a preview draws their cards;
// none when the tab has no Plan shape, or the document is not named.
async function planContentFor(
  tab: Tab,
  auth: { env: Env; token: string; documentId?: string } | undefined,
): Promise<{ items?: ReadonlyMap<string, Item>; itemTypes?: readonly ItemTypeDef[] }> {
  const plan = tab.elements.some(
    (el) => el.type === 'shape' && (el.shape === 'plan-board' || el.shape === 'plan-card'),
  );
  if (!plan || !auth?.documentId) return {};
  const path = `/documents/${encodeURIComponent(auth.documentId)}`;
  // The items, and the document's item types so custom types keep their colours
  // (docs/specs/025-plan/item-types.md). Each is best-effort: a preview without them still draws.
  const [items, doc] = await Promise.all([
    apiJson<ItemsResponse>(auth.env, auth.token, `${path}/items`).catch(() => null),
    apiJson<{ document?: { itemTypes?: ItemTypeCatalogue | null } }>(
      auth.env,
      auth.token,
      path,
    ).catch(() => null),
  ]);
  return {
    ...(items ? { items: new Map(items.items.map((i) => [i.id, i])) } : {}),
    itemTypes: typesOf(readItemTypeCatalogue(doc?.document?.itemTypes ?? null)),
  };
}

// A PNG preview of the tab, its images and icons resolved as the editor draws them.
export async function tabPreview(
  tab: Tab,
  auth?: { env: Env; token: string; documentId?: string },
): Promise<ImageBlock> {
  const resolveImageHref = auth ? await buildImageResolver(auth.env, auth.token, tab) : undefined;
  const png = await svgToPngBase64(
    renderElementsToSvg(tab, {
      resolveImageHref,
      resolveIconArt: resolveIconExportArt,
      resolveStickerArt,
      ...(await planContentFor(tab, auth)),
    }),
  );
  return { type: 'image', data: png, mimeType: 'image/png' };
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
  return { ...result, content: [...result.content, ...texts, preview] };
}
