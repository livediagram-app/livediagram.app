// A plan drawn as an SVG, for its preview (liveworkspace/docs/previews.md): the first tab, or one tab, with the shared
// DOM-free renderer, its icons drawn as their glyphs, its boards, sheets and dashboards from the plan's own cards.
// Drawn in the plan's Durable Object, where the content is, when liveworkspace's previews service asks the export
// door (plan-room.ts `exportImage`); the platform stores it, decides when it is stale and serves it, so nothing here
// caches or writes a picture. Rendering on request means a plan nobody looks at never costs a render.

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
// elements render their real glyph in the preview instead of
// the renderer's box-with-label fallback.
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import {
  getTab,
  getTabBody,
  stampTabElementCount,
  type StoredTabBody,
  listItems,
  listSheets,
} from './db';
import { getPlanItemTypes } from './plan-room/plan-content';
import type { ProjectDTO, PlanEnv } from './types';
import { dashboardImageOf } from './thumbnail-dashboard';

// The plan fields a drawing needs. `itemTypes`: a caller that read them passes them; one that did not leaves them
// out, and they are read only when a drawing draws cards. Never defaulted to none: a board then takes no type and
// draws no card.
export type DrawSubject = Pick<ProjectDTO, 'id' | 'name'> & {
  itemTypes?: ProjectDTO['itemTypes'];
};

// `defer` hands the count stamp (below) to a waitUntil, so the drawing goes out as soon as it is drawn.
export type DrawOptions = { defer?: (write: Promise<unknown>) => void };

// The first tab (or `tabId`) drawn, or null when there is nothing to draw: no tab, an empty or unparseable one.
export async function drawPlan(
  env: PlanEnv,
  plan: DrawSubject,
  tabId: string | null,
  opts: DrawOptions = {},
): Promise<string | null> {
  const body = tabId ? await getTabBody(env, plan.id, tabId) : await getTabBody(env, plan.id);
  return renderTabBodyToSvg(env, plan, body, opts);
}

// One tab drawn by the shared renderer, for `GET .../tabs/:tabId/render.svg` (docs/specs/015-api/api.md): the
// CLI's pull --svg and tab render, and any script. Unlike a preview it draws an empty tab too; an image element
// draws its placeholder. Null when the tab is not in the project or its body does not parse.
export async function renderTabSvg(
  env: PlanEnv,
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
  env: PlanEnv,
  body: StoredTabBody,
  count: number,
  opts: DrawOptions,
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

// Turn a stored tab body into an SVG, for the first tab or one tab. A Form tab draws its form. Null when the body is
// absent, unparseable, or has nothing to draw (an empty canvas has no
// meaningful thumbnail; the row shows its icon instead).
async function renderTabBodyToSvg(
  env: PlanEnv,
  liveDoc: DrawSubject,
  body: StoredTabBody | null,
  opts: DrawOptions = {},
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
  // A Dashboard draws its layout, whose notes and tab slots are not elements.
  const dashboard = tabKindOf(parsed) === 'dashboard';
  if (parsed.elements.length === 0 && !dashboard) return null;
  // `tabs.data` is the tab body minus id + name (see db/tabs.ts
  // upsertTab); re-attach them so the value is a complete Tab. The
  // renderer only reads `elements` + `backgroundColor`, both already in
  // the parsed body.
  // Migrated like every other stored-tab read (docs/specs/011-theme/retired-schemes.md).
  const stored = migrateStoredTab({ id: body.id, name: liveDoc.name, ...parsed } as Tab);
  // A Dashboard is its page laid out, its metrics and charts drawn from the cards (thumbnail-dashboard.ts), never the
  // canvas under it with each one a labelled box.
  const laidOut = dashboard ? await dashboardImageOf(env, liveDoc.id, stored) : null;
  const tab = laidOut?.tab ?? stored;
  if (tab.elements.length === 0) return null;
  // A Plan board or card draws its project's items (docs/specs/026-plan/plan-board.md); a Dashboard's metrics and
  // charts count them.
  const plan = tab.elements.some(
    (el) =>
      el.type === 'shape' &&
      (el.shape === 'plan-board' ||
        el.shape === 'plan-card' ||
        (!!laidOut && el.shape === 'plan-view')),
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
          liveDoc.itemTypes !== undefined ? liveDoc.itemTypes : getPlanItemTypes(env, liveDoc.id),
        ])
      : [undefined, null];
  const sheets = frames.length
    ? renderModelsForTab(sheetJson, frames, {
        cards: sheetCards && items ? cardSourceOf(items.values(), typesOf(catalogue)) : null,
      })
    : undefined;
  const types = plan ? typesOf(catalogue) : undefined;
  const drawWith = {
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
    items,
    sheets,
    // Custom types keep their colours (docs/specs/026-plan/item-types.md).
    itemTypes: types,
    ...(laidOut ? { resolvePlanArt: laidOut.artWith(items ?? new Map(), types ?? []) } : {}),
  };
  return renderElementsToSvg(tab, drawWith);
}
