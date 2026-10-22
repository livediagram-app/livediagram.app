// A Plan tab's preview as the editor exports it (docs/specs/015-api/mcp-server.md §5, docs/specs/026-plan/plan-tabs.md
// "Export"): a Board tab its board alone, a Sheet tab its Sheet, a Dashboard its page laid out with every metric, chart
// and card drawn from the document's cards (@livepages/plan-art), never the raw elements stacked where they sit.
// Null for any other tab. Every read is best-effort: what cannot be read draws as the editor draws it missing.
import type {
  DocumentResponse,
  PlanResponse,
  SheetsResponse,
  TabResponse,
} from '@livepages/api-schema';
import {
  PIE_PALETTE,
  canvasSurface,
  renderElementsToSvg,
  type ResolvePlanArt,
  type Tab,
} from '@livepages/document';
import { statusPhasesOf, type Item, type ItemTypeDef } from '@livepages/items';
import {
  sheetContentSize,
  sheetFromJson,
  sheetFramesOf,
  type SheetJson,
} from '@livepages/sheets';
import { planImageOf, planTabKindOf, planViewArt, type PlanArtData } from '@livepages/plan-art';
import { apiJson } from './api';
import type { Env } from './env';

// The most other tabs a Dashboard's preview reads, for its tab slots and its boards' statuses.
export const PLAN_PREVIEW_TABS_MAX = 20;

// The backdrop an export paints a Plan tab on when the tab names none.
const EXPORT_BG = '#ffffff';

// The tab as laid out, and its pictures once the cards it shows are read (`content`, for the laid-out tab).
type PlanPreview = {
  tab: Tab;
  artWith: (content: {
    items?: ReadonlyMap<string, Item>;
    itemTypes?: readonly ItemTypeDef[];
  }) => ResolvePlanArt;
  // A Sheet tab's sheets, read to size its image, for the preview to draw without reading them again.
  sheets?: SheetJson[];
};

// A Sheet tab's sheets (best-effort: null when they cannot be read, and the Sheet keeps its size).
async function sheetsOfTab(
  tab: Tab,
  auth: { env: Env; token: string; documentId: string },
): Promise<SheetJson[] | null> {
  const ids = [...new Set(sheetFramesOf(tab.elements as never).map((f) => f.sheetId))];
  if (ids.length === 0) return null;
  const path = `/documents/${encodeURIComponent(auth.documentId)}/sheets?ids=${ids.join(',')}`;
  const read = await apiJson<SheetsResponse>(auth.env, auth.token, path).catch(() => null);
  return read?.sheets ?? null;
}

// Every tab of the document, this one as given; the rest read in parallel, up to PLAN_PREVIEW_TABS_MAX.
async function documentTabs(
  tab: Tab,
  auth: { env: Env; token: string; documentId: string },
): Promise<Tab[]> {
  const path = `/documents/${encodeURIComponent(auth.documentId)}`;
  const doc = await apiJson<DocumentResponse>(auth.env, auth.token, path).catch(() => null);
  const others = (doc?.document.tabs ?? [])
    .filter((t) => t.id !== tab.id)
    .slice(0, PLAN_PREVIEW_TABS_MAX);
  const read = await Promise.all(
    others.map((t) =>
      apiJson<TabResponse>(auth.env, auth.token, `${path}/tabs/${encodeURIComponent(t.id)}`)
        .then((r) => r.tab as unknown as Tab)
        .catch(() => null),
    ),
  );
  return [tab, ...read.filter((t): t is Tab => t !== null)];
}

export async function planPreviewFor(
  tab: Tab,
  auth: { env: Env; token: string; documentId?: string } | undefined,
  render: (tab: Tab) => string = (shown) => renderElementsToSvg(shown, {}),
): Promise<PlanPreview | null> {
  const kind = planTabKindOf(tab);
  if (!kind) return null;
  const documentId = auth?.documentId;
  const [tabs, plan] =
    kind === 'dashboard' && auth && documentId
      ? await Promise.all([
          documentTabs(tab, { ...auth, documentId }),
          apiJson<PlanResponse>(
            auth.env,
            auth.token,
            `/documents/${encodeURIComponent(documentId)}/plan`,
          ).catch(() => null),
        ])
      : [[tab], null];
  // A Sheet tab's image shows every filled cell, as the tab does, rather than the frame's first screen of them.
  const sheets =
    kind === 'sheet' && auth && documentId ? await sheetsOfTab(tab, { ...auth, documentId }) : null;
  const byId = new Map((sheets ?? []).map((s) => [s.id, s]));
  const now = new Date();
  const image = planImageOf(tab, {
    tabs,
    now,
    renderDiagram: render,
    sheetHeads: (id) => byId.get(id)?.layout.showHeaders !== false,
    sheetContent: (id) => {
      const json = byId.get(id);
      return json ? sheetContentSize(sheetFromJson(json)) : null;
    },
  });
  if (!image) return null;
  const boards = tabs.flatMap((t) =>
    t.elements.flatMap((el) =>
      el.type === 'shape' && el.shape === 'plan-board'
        ? [(el as { planBoard?: unknown }).planBoard]
        : [],
    ),
  );
  const statusPhases = statusPhasesOf(boards);
  const statusNames = new Map((plan?.statuses ?? []).map((s) => [s.status, s.name]));
  const surface = canvasSurface(image.tab.backgroundColor ?? EXPORT_BG);
  const { art } = image;
  return {
    tab: image.tab,
    ...(sheets ? { sheets } : {}),
    artWith: (content) => {
      const data: PlanArtData = {
        items: content.items ?? new Map(),
        types: content.itemTypes ?? plan?.types ?? [],
        statusPhases,
        statusNames,
        now,
        chartPalette: PIE_PALETTE,
      };
      return (el) => art.get(el.id) ?? (el.planView ? planViewArt(el, data, surface) : undefined);
    },
  };
}
