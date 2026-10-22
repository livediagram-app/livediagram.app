// Project SVG snapshot render-cache (docs/specs/006-project/project-snapshots.md). One cached SVG per
// project, stored in R2 (key `thumb/<projectId>`), refreshed lazily on
// read: if the cache is fresh (rendered at or after the project's last
// save) we stream the stored bytes; otherwise we render the first tab
// with the shared DOM-free renderer, write it back, and stamp it fresh.
//
// Two delivery paths share this one artifact (the whole point of the
// design): the owner-authed Explorer thumbnail (GET
// /api/projects/:id/thumbnail) and the public, share-code-scoped live
// image (GET /api/share/:code/image.svg). Rendering on read — rather
// than on every save — means a project nobody looks at never costs a
// render, and every write path (editor, collaborators, MCP, API token)
// invalidates the snapshot uniformly because they all bump saved_at.

import {
  drawnCount,
  formLook,
  migrateStoredTab,
  renderElementsToSvg,
  resolveFontStack,
  tabKindOf,
  type Tab,
} from '@liveplanner/project';
import { readForm } from '@liveplanner/forms';
import { formArt } from '@liveplanner/plan-art';
import { cardSourceOf, typesOf } from '@liveplanner/items';
import { renderModelsForTab, sheetFramesOf } from '@liveplanner/sheets';
// Static-import icon resolver (bundle size is fine in a Worker) so icon
// elements render their real glyph in the snapshot / live image instead of
// the renderer's box-with-label fallback.
import { resolveIconExportArt, resolveStickerArt } from '@liveplanner/icons/resolve';
import {
  getProjectItemTypes,
  getTab,
  getTabBody,
  getThumbRenderedAt,
  markThumbRendered,
  stampTabElementCount,
  thumbnailKey,
  type StoredTabBody,
  listItems,
  listSheets,
} from './db';
import type { ProjectDTO, Env } from './types';

// Content type for the cached SVG snapshot. Local to this module — the
// HTTP responses set their own header (responses.ts); this only stamps
// the R2 object's metadata on write.
const THUMBNAIL_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

// The project fields a snapshot needs. `thumbRenderedAt` is optional: a
// caller that already read it alongside the project row (the Explorer
// thumbnail route, via getProjectThumbMeta) passes it and saves a query;
// one that didn't leaves it out and it is read here.
// `itemTypes` likewise: a caller that read them passes them; one that did not (the Explorer thumbnail route, whose
// one read leaves the catalogue out) leaves them out, and they are read only when a render draws cards. Never
// defaulted to none: a board then takes no type and draws no card.
export type ThumbnailSubject = Pick<ProjectDTO, 'id' | 'name' | 'savedAt'> & {
  itemTypes?: ProjectDTO['itemTypes'];
  thumbRenderedAt?: number | null;
};

// `defer` hands the cache write (R2 put + freshness stamp) to the
// request's waitUntil, so a stale snapshot's response goes out as soon as
// it is rendered instead of after two more round trips. Without it the
// write is awaited inline, as before.
export type ThumbnailOptions = { defer?: (write: Promise<unknown>) => void };

// Resolve a project's cached SVG snapshot, rendering + caching it first
// if stale. Returns null — caller should 404 / fall back to an icon —
// when there's nothing to show: no R2 binding (a deployment without
// storage), no tab, or an empty / unparseable first tab.
export async function getProjectThumbnailSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  opts: ThumbnailOptions = {},
): Promise<string | null> {
  // No object store: nothing to cache into or read from. The endpoints
  // 404 and the Explorer row keeps its generic icon on a binding-less deploy.
  if (!env.SNAPSHOTS) return null;
  const key = thumbnailKey(liveDoc.id);

  // Fresh = rendered at or after the last save. saved_at is bumped by
  // every tab write, so any content change makes the snapshot stale.
  const renderedAt =
    liveDoc.thumbRenderedAt !== undefined
      ? liveDoc.thumbRenderedAt
      : await getThumbRenderedAt(env, liveDoc.id);
  if (renderedAt !== null && renderedAt >= liveDoc.savedAt) {
    const cached = await env.SNAPSHOTS.get(key);
    // A present object is the happy path. A miss here means the object
    // was evicted / never written despite the freshness stamp, so we
    // fall through and re-render rather than 404 a project that has
    // content.
    if (cached) return await cached.text();
  }

  const svg = await renderTabBodyToSvg(env, liveDoc, await getTabBody(env, liveDoc.id), opts);
  if (svg == null) return null;

  // Best effort: a write failure (R2 hiccup) must not fail the read —
  // we still return the freshly rendered SVG, just without caching it,
  // so the next read renders again. Only stamp the row as fresh once the
  // object is actually in R2, or a later read would trust a stale/absent
  // object and skip the re-render.
  const bucket = env.SNAPSHOTS;
  const write = (async () => {
    try {
      await bucket.put(key, svg, { httpMetadata: { contentType: THUMBNAIL_CONTENT_TYPE } });
      await markThumbRendered(env, liveDoc.id, Date.now());
    } catch {
      // Swallow: the SVG is still returned to the caller below.
    }
  })();
  if (opts.defer) opts.defer(write);
  else await write;
  return svg;
}

// Live image for a SPECIFIC tab (docs/specs/013-workspace/live-image-share.md's per-tab picker, now surfaced
// in the Share dialog). Rendered on read and deliberately NOT written to
// the R2 snapshot cache: `thumb/<projectId>` is the first-tab artifact
// shared with the Explorer thumbnail (docs/specs/006-project/project-snapshots.md) and carries a single
// per-project freshness stamp, so it has no room for a second tab. A
// non-default tab is a niche embed, and the endpoint's short
// stale-while-revalidate Cache-Control keeps repeat views cheap without
// a persistent cache. Returns null (caller 404s) when there's no object
// store, the tab isn't in the project, or the tab is empty / unparseable.
export async function getProjectTabImageSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  tabId: string,
): Promise<string | null> {
  // Gate on the same optional R2 binding as the cached path, so the
  // whole live-image feature is uniformly off on a binding-less deploy.
  if (!env.SNAPSHOTS) return null;
  return renderTabBodyToSvg(env, liveDoc, await getTabBody(env, liveDoc.id, tabId));
}

// One tab drawn by the shared renderer, for `GET .../tabs/:tabId/render.svg` (docs/specs/015-api/api.md): the
// CLI's pull --svg and tab render, and any script. Unlike a snapshot it draws an empty tab too; an image element
// draws its placeholder. Null when the tab is not in the project or its body does not parse.
export async function renderTabSvg(
  env: Env,
  projectId: string,
  tabId: string,
): Promise<string | null> {
  let stored: Awaited<ReturnType<typeof getTab>>;
  try {
    stored = await getTab(env, projectId, tabId);
  } catch (err) {
    console.warn('[render] tab unreadable', { projectId, tabId, error: String(err) });
    return null;
  }
  if (!stored) return null;
  const tab = migrateStoredTab({ ...stored, elements: stored.elements ?? [] });
  return renderElementsToSvg(tab, {
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
  });
}

// The lazy backfill of tabs.element_count: a tab whose count is still unknown (NULL) gets it
// from the parse a render does anyway, so the lists know an empty project after one ask. Best effort:
// a failed stamp leaves the count unknown, which only means the row asks again.
function stampUnknownCount(
  env: Env,
  body: StoredTabBody,
  count: number,
  opts: ThumbnailOptions,
): Promise<void> | undefined {
  if (body.elementCount !== null) return undefined;
  const stamp = stampTabElementCount(env, body.id, count).catch((error: unknown) => {
    console.warn('[thumbnail] count stamp failed', { tabId: body.id, error: String(error) });
  });
  if (opts.defer) {
    opts.defer(stamp);
    return undefined;
  }
  return stamp;
}

// Turn a stored tab body into an SVG, shared by the first-tab snapshot and
// the per-tab live image. A Form tab draws its form. Null when the body is
// absent, unparseable, or has nothing to draw (an empty canvas has no
// meaningful thumbnail; the row shows its icon instead).
async function renderTabBodyToSvg(
  env: Env,
  liveDoc: ThumbnailSubject,
  body: StoredTabBody | null,
  opts: ThumbnailOptions = {},
): Promise<string | null> {
  if (!body) return null;
  let parsed: Partial<Tab>;
  try {
    parsed = JSON.parse(body.data) as Partial<Tab>;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.elements)) return null;
  await stampUnknownCount(env, body, drawnCount(parsed), opts);
  // A Form tab is its form as respondents see it on its tab's look (docs/specs/030-forms/forms.md "Look"), the picture
  // the MCP preview draws: the form is not an element, so the canvas under it has nothing to show.
  const form = tabKindOf(parsed) === 'form' ? readForm(parsed.form) : null;
  if (form) {
    const look = formLook(parsed);
    return formArt(form, look, resolveFontStack(look.font)).svg;
  }
  if (parsed.elements.length === 0) return null;
  // `tabs.data` is the tab body minus id + name (see db/tabs.ts
  // upsertTab); re-attach them so the value is a complete Tab. The
  // renderer only reads `elements` + `backgroundColor`, both already in
  // the parsed body.
  // Migrated like every other stored-tab read (docs/specs/011-theme/retired-schemes.md).
  const tab = migrateStoredTab({ id: liveDoc.id, name: liveDoc.name, ...parsed } as Tab);
  // A Plan board or card draws its project's items (docs/specs/026-plan/plan-board.md).
  const plan = tab.elements.some(
    (el) => el.type === 'shape' && (el.shape === 'plan-board' || el.shape === 'plan-card'),
  );
  // A Sheet draws its window of cells (docs/specs/029-sheets/sheet.md "Exports and images"); card functions in
  // its formulas read the items too.
  const frames = sheetFramesOf(tab.elements);
  const sheetJson = frames.length
    ? await listSheets(env, liveDoc.id, {
        ids: [...new Set(frames.map((f) => f.sheetId))].slice(0, 50),
      })
    : [];
  const sheetCards = sheetJson.some((s) =>
    s.cells.some((c) => c.i && 'f' in c.i && c.i.f.t.includes('CARD')),
  );
  const [items, catalogue] =
    plan || sheetCards
      ? await Promise.all([
          listItems(env, liveDoc.id).then((all) => new Map(all.map((i) => [i.id, i]))),
          liveDoc.itemTypes !== undefined
            ? liveDoc.itemTypes
            : getProjectItemTypes(env, liveDoc.id),
        ])
      : [undefined, null];
  const sheets = frames.length
    ? renderModelsForTab(sheetJson, frames, {
        cards: sheetCards && items ? cardSourceOf(items.values(), typesOf(catalogue)) : null,
      })
    : undefined;
  const drawWith = {
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
    items,
    sheets,
    // Custom types keep their colours (docs/specs/026-plan/item-types.md).
    itemTypes: plan ? typesOf(catalogue) : undefined,
  };
  return renderElementsToSvg(tab, drawWith);
}
