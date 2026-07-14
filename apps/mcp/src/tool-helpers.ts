// Shared result / auth plumbing for the MCP tools (spec/62): the text /
// error / inline-image result shapes and the bearer-token guard every tool
// uses. The pure tab builders live in tab-builders.ts (render-free so they
// unit-test); tools.ts keeps the tool registrations themselves.

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { renderElementsToSvg, type Tab } from '@livediagram/diagram';
// Static-import icon resolver (Worker bundle, size not user-facing) so icon
// elements render their real glyph in the inline image.
import { resolveIconExportArt } from '@livediagram/icons/resolve';
import { bytesToBase64, svgToPngBase64 } from './render';
import { apiFetch } from './api';
import type { Env } from './env';

export type Extra = RequestHandlerExtra<never, never>;
type ToolResult = {
  content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  >;
  isError?: boolean;
};

export const deepLink = (id: string) => `https://livediagram.app/diagram/${id}`;

// A share link's public URL (spec/24): visitors land on /diagram/shared?s=<code>
// and the app resolves the code to the diagram + granted role.
export const shareUrl = (code: string) =>
  `https://livediagram.app/diagram/shared?s=${encodeURIComponent(code)}`;

export function requireToken(extra: Extra): string {
  const token = extra.authInfo?.token;
  if (!token) throw new Error('unauthorized: no bearer token');
  return token;
}

export function textResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

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
    renderElementsToSvg(tab, { resolveImageHref, resolveIconArt: resolveIconExportArt }),
  );
  return {
    content: [
      { type: 'text', text: JSON.stringify(value, null, 2) },
      { type: 'image', data: png, mimeType: 'image/png' },
    ],
  };
}
