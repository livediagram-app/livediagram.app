// The inline-PNG result helper for the MCP tools (spec/62 §5), split from
// tool-helpers.ts for the same reason tab-builders.ts was: this file reaches
// the resvg WASM renderer, which cannot load in the plain-node test
// environment, and importing it dragged the auth guard and the plain result
// shapes down with it. They are render-free and unit-tested now; everything
// that genuinely needs a rasteriser lives here.

import { renderElementsToSvg, type Tab } from '@livediagram/diagram';
// Static-import icon resolver (Worker bundle, size not user-facing) so icon
// elements render their real glyph in the inline image.
import { resolveIconExportArt, resolveStickerArt } from '@livediagram/icons/resolve';
import { bytesToBase64, svgToPngBase64 } from './render';
import { apiFetch } from './api';
import type { Env } from './env';
import type { ToolResult } from './tool-helpers';

// Per-image cap for embedding (spec/62 §5): a diagram can reference large
// uploads, and inlining them as base64 into the preview PNG's own base64
// response would bloat what the model receives. Above this, the image falls
// back to the placeholder box (as before) — the structured elements still carry
// its id.
const MAX_EMBED_BYTES = 2 * 1024 * 1024;

// Prefetch the bytes of every image element on the tab and return a
// resolveImageHref that inlines them as data URIs, so the render shows the real
// picture instead of a placeholder (spec/62 §5). resvg (WASM) can't fetch, so
// the bytes must be inlined. Owner-authed via the caller's token — the same
// GET /api/images/:id the app uses. Any failure (missing, too big, error) skips
// that image and the placeholder shows; a diagram with no images does no work.
async function buildImageResolver(
  env: Env,
  token: string,
  tab: Tab,
): Promise<((imageId: string) => string | undefined) | undefined> {
  const ids = [
    ...new Set(
      tab.elements
        .filter((e): e is typeof e & { imageId: string } => e.type === 'image' && !!e.imageId)
        .map((e) => e.imageId),
    ),
  ];
  if (ids.length === 0) return undefined;
  const byId = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await apiFetch(env, token, `/images/${id}`);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_EMBED_BYTES) return;
        const ct = res.headers.get('Content-Type') ?? 'image/png';
        byId.set(id, `data:${ct};base64,${bytesToBase64(new Uint8Array(buf))}`);
      } catch {
        // Skip — the placeholder renders (unchanged behaviour).
      }
    }),
  );
  return byId.size > 0 ? (imageId: string) => byId.get(imageId) : undefined;
}

// `auth` (env + the caller's token) enables real image embedding; omit it to
// render placeholders for image elements (the pre-embedding behaviour).
export async function imageResult(
  value: unknown,
  tab: Tab,
  auth?: { env: Env; token: string },
): Promise<ToolResult> {
  const resolveImageHref = auth ? await buildImageResolver(auth.env, auth.token, tab) : undefined;
  const png = await svgToPngBase64(
    renderElementsToSvg(tab, {
      resolveImageHref,
      resolveIconArt: resolveIconExportArt,
      resolveStickerArt,
    }),
  );
  return {
    content: [
      { type: 'text', text: JSON.stringify(value, null, 2) },
      { type: 'image', data: png, mimeType: 'image/png' },
    ],
  };
}
