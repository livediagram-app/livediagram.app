// A plan drawn as an SVG, for its preview (liveworkspace/docs/specs/006-media/previews.md): the first tab, or one tab, with the shared
// DOM-free renderer, its icons drawn as their glyphs, its boards, sheets and dashboards from the plan's own cards.
// Drawn in the plan's Durable Object, where the content is, when liveworkspace's previews service asks the export
// door (plan-room.ts `exportImage`); the platform stores it, decides when it is stale and serves it, so nothing here
// caches or writes a picture. Rendering on request means a plan nobody looks at never costs a render.

import {
  drawnCount,
  formLook,
  migrateStoredTab,
  readDashboard,
  renderElementsToSvg,
  resolveFontStack,
  tabKindOf,
  type Tab,
} from '@liveplanner/project';
import { questionsOf, readForm } from '@liveplanner/forms';
import {
  redactItemsForCommunity,
  redactPlanTabForCommunity,
  redactSheetForCommunity,
} from './community-redact';
import { readResponseSheetIds } from './plan-room/community-post';
import { formArt } from '@liveplanner/plan-art';
import { openCommentCountsOfPlan } from './db/card-threads';
import { cardSourceOf, itemIdsShownOnTab, typesOf, type Item } from '@liveplanner/items';
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
// `community`: a Community visitor's drawing (docs/specs/025-community/community.md "Viewing a post's plan"), from the
// redacted plan (community-redact.ts), so no comment, person, vote or form answer reaches the public card image.
export type DrawOptions = { defer?: (write: Promise<unknown>) => void; community?: boolean };

// The first tab (or `tabId`) drawn, or null when there is nothing to draw: no tab, an empty or unparseable one.
export async function drawPlan(
  env: PlanEnv,
  plan: DrawSubject,
  tabId: string | null,
  opts: DrawOptions = {},
): Promise<string | null> {
  const body = tabId ? await getTabBody(env, plan.id, tabId) : await getTabBody(env, plan.id);
  // A named tab's picture is what a link confined to it gets: its card functions read only the cards it shows.
  return renderTabBodyToSvg(env, plan, body, opts, tabId !== null);
}

// Something to show, for a Community post (docs/specs/025-community/community.md "Publishing"): the first tab is not
// empty, since it is the post's card picture. A Board with a card, a Sheet with a value, a Dashboard with a part, a
// Form with a question, any other tab with an element. Counted from the stored body and the plan's store, never
// rendered.
export async function firstTabHasSomethingToShow(env: PlanEnv, planId: string): Promise<boolean> {
  const body = await getTabBody(env, planId);
  if (!body) return false;
  let parsed: Partial<Tab>;
  try {
    parsed = JSON.parse(body.data) as Partial<Tab>;
  } catch {
    return false;
  }
  const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
  const kind = tabKindOf(parsed);
  if (kind === 'form') {
    const form = readForm(parsed.form);
    return !!form && questionsOf(form).length > 0;
  }
  if (kind === 'dashboard') {
    const layout = readDashboard(parsed.dashboard);
    return !!layout?.rows.some((row) => row.slots.some((slot) => !!slot.content));
  }
  const frames = sheetFramesOf(elements);
  if (frames.length > 0) {
    const sheets = await listSheets(env, planId, {
      ids: [...new Set(frames.map((f) => f.sheetId))].slice(0, 50),
    });
    if (sheets.some((s) => s.cells.some((c) => c.i !== undefined))) return true;
  }
  const boards = elements.some(
    (el) => el.type === 'shape' && (el.shape === 'plan-board' || el.shape === 'plan-card'),
  );
  if (boards) return itemIdsShownOnTab(elements, await listItems(env, planId)).size > 0;
  if (kind === 'sheet' || kind === 'board') return false;
  return elements.length > 0;
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
  // Card functions read only the items this tab shows (docs/specs/029-sheets/sheet.md "Exports and images").
  scoped = false,
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
  const migrated = migrateStoredTab({ id: body.id, name: liveDoc.name, ...parsed } as Tab);
  const community = opts.community === true;
  const stored = community ? redactPlanTabForCommunity(migrated) : migrated;
  // A Dashboard is its page laid out, its metrics and charts drawn from the cards (thumbnail-dashboard.ts), never the
  // canvas under it with each one a labelled box.
  const laidOut = dashboard
    ? await dashboardImageOf(
        env,
        liveDoc.id,
        stored,
        undefined,
        community ? redactPlanTabForCommunity : undefined,
      )
    : null;
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
  const readSheets = frames.length
    ? await listSheets(env, liveDoc.id, {
        ids: [...new Set(frames.map((f) => f.sheetId))].slice(0, 50),
      })
    : [];
  const responseSheets =
    community && readSheets.length ? await readResponseSheetIds(env, liveDoc.id) : null;
  const sheetJson = responseSheets
    ? readSheets.map((s) => redactSheetForCommunity(s, responseSheets))
    : readSheets;
  const sheetCards = sheetJson.some((s) =>
    s.cells.some((c) => c.i && 'f' in c.i && c.i.f.t.includes('CARD')),
  );
  const [read, catalogue] =
    plan || sheetCards
      ? await Promise.all([
          // Each card's comment count, from its threads' links (no thread is read): its face draws it. A Community
          // visitor's drawing counts none.
          Promise.all([
            listItems(env, liveDoc.id),
            // A count that cannot be read leaves the faces without it rather than the image undrawn.
            Promise.resolve()
              .then(() =>
                community ? new Map<string, number>() : openCommentCountsOfPlan(env, liveDoc.id),
              )
              .catch((err: unknown) => {
                console.warn('[thumbnail] comment.counts.failed', { error: String(err) });
                return new Map<string, number>();
              }),
          ]).then(
            ([all, counts]) =>
              new Map(
                all.map((i) => [
                  i.id,
                  counts.has(i.id) ? { ...i, openComments: counts.get(i.id) } : i,
                ]),
              ),
          ),
          liveDoc.itemTypes !== undefined ? liveDoc.itemTypes : getPlanItemTypes(env, liveDoc.id),
        ])
      : [undefined, null];
  // A Community visitor's cards carry nobody (community-redact.ts).
  const items =
    read && community
      ? new Map(redactItemsForCommunity([...read.values()], catalogue).map((i) => [i.id, i]))
      : read;
  const cardItems = (all: Map<string, Item>) => {
    if (!scoped) return all.values();
    const shown = itemIdsShownOnTab(tab.elements, all.values());
    return [...all.values()].filter((item) => shown.has(item.id));
  };
  const sheets = frames.length
    ? renderModelsForTab(sheetJson, frames, {
        cards: sheetCards && items ? cardSourceOf(cardItems(items), typesOf(catalogue)) : null,
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
