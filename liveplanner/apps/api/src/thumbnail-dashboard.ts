// A Dashboard's live image and Explorer thumbnail (docs/specs/013-workspace/live-image-share.md "A Dashboard"): its
// page laid out as the editor's export lays it out (@liveplanner/plan-art planImageOf), each Board or Sheet tab slot
// drawing that tab's board or Sheet, and each metric and chart drawn from the project's cards (planArtResolver), never
// a box labelled with its kind. The tabs it draws from are read in one bounded query.
import {
  EXPORT_BG,
  PIE_PALETTE,
  canvasSurface,
  readDashboard,
  type ResolvePlanArt,
  type Tab,
} from '@liveplanner/project';
import {
  statusColumnsOfSetups,
  statusPhasesOf,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { planArtResolver, planImageOf } from '@liveplanner/plan-art';
import { dashboardSourceTabs } from './db';
import type { PlanEnv } from './types';

// The most other tabs a Dashboard's image reads: every tab its slots show (at most 12 rows of 4) and the boards whose
// columns name the statuses its charts count by. Past it, a slot's tab draws as deleted and a status as unnamed.
export const DASHBOARD_IMAGE_TABS_MAX = 60;

export type DashboardImage = {
  // The page as a tab of elements, for the SVG renderer.
  tab: Tab;
  // Its pictures, once the cards they draw from are read.
  artWith: (items: ReadonlyMap<string, Item>, types: readonly ItemTypeDef[]) => ResolvePlanArt;
};

const boardSetupsOf = (tab: Tab): unknown[] =>
  tab.elements.flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-board' ? [el.planBoard] : [],
  );

/** The Dashboard `tab` of project `projectId` laid out for an image, or null when it lays out nothing. */
export async function dashboardImageOf(
  env: PlanEnv,
  projectId: string,
  tab: Tab,
  now: Date = new Date(),
): Promise<DashboardImage | null> {
  const layout = readDashboard(tab.dashboard);
  const shown = new Set<string>();
  for (const row of layout?.rows ?? [])
    for (const slot of row.slots)
      if (slot.content?.type === 'tab' && slot.content.tabId !== tab.id)
        shown.add(slot.content.tabId);
  const read = await dashboardSourceTabs(env, projectId, [...shown], DASHBOARD_IMAGE_TABS_MAX);
  const tabs = [tab, ...read.filter((t) => t.id !== tab.id)];
  const image = planImageOf(tab, { tabs, now });
  if (!image) return null;
  // The statuses every board names, in tab order (the editor's own order puts the open tab first; a Dashboard holds
  // few boards of its own, so the names agree).
  const setups = tabs.flatMap(boardSetupsOf);
  const statusPhases = statusPhasesOf(setups);
  const statusNames = new Map(statusColumnsOfSetups(setups));
  const surface = canvasSurface(image.tab.backgroundColor ?? EXPORT_BG);
  console.info('[thumbnail] dashboard laid out', {
    slots: layout?.rows.reduce((n, r) => n + r.slots.length, 0) ?? 0,
    tabsShown: shown.size,
    tabsRead: read.length,
  });
  return {
    tab: image.tab,
    artWith: (items, types) =>
      planArtResolver(
        image.art,
        { items, types, statusPhases, statusNames, now, chartPalette: PIE_PALETTE },
        surface,
      ),
  };
}
