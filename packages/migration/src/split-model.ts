// The splitter's model (split.ts): the old tabs' kinds and fields, each app's address, the source as both entry points
// hand it in, and the drafts each tab becomes. Shared by split.ts and its pieces.
import type { MigrationApp, MigrationChangeset, MigrationPlanData } from './contract';

export type Rec = Record<string, unknown>;
export const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
export const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

// ---- What the old tabs held ------------------------------------------------------------------------------------------

// Plan's tab kinds: a tab of one is always Plan, whatever its mode says.
const PLAN_KINDS: ReadonlySet<unknown> = new Set(['board', 'sheet', 'dashboard', 'form']);
// Pages' mode, under its id and its two older names.
const PAGES_MODES: ReadonlySet<unknown> = new Set(['pages', 'illustrate', 'infographic']);
// The shapes that drew from Plan's item and sheet stores.
const PLAN_SHAPES: ReadonlySet<unknown> = new Set([
  'plan-board',
  'plan-card',
  'plan-view',
  'plan-sheet',
]);
// The tab fields only Pages read, and only Plan.
export const PAGES_FIELDS = ['pages', 'articles', 'pageOrientation'] as const;
export const PLAN_FIELDS = ['dashboard', 'form'] as const;
// A chart's fields that read a sheet.
export const CHART_SHEET_FIELDS = ['chartSource', 'sheetAnchor'] as const;
// Page kinds by the app that now owns them. A page with no kind is an infographic nobody chose yet. livedesign also
// has photo pages, which the old site never had; one is routed there all the same.
export const DESIGN_PAGE_KINDS: ReadonlySet<unknown> = new Set(['logo', 'wireframe', 'photo']);
export const DOCUMENT_PAGE_KINDS: ReadonlySet<unknown> = new Set([
  undefined,
  'infographic',
  'article',
  'slide',
]);
// The modes a livediagram document's intent may name.
const DIAGRAM_MODES: ReadonlySet<unknown> = new Set(['diagram', 'draw', 'workshop', 'facilitate']);
const DIAGRAM_KINDS: ReadonlySet<unknown> = new Set(['diagram', 'event-storming', 'whiteboard']);

type TabClass = 'livediagram' | 'liveplanner' | 'pages';
export type Family = 'livedocuments' | 'livedesign';

export function classify(body: Rec): TabClass {
  if (PLAN_KINDS.has(body.kind)) return 'liveplanner';
  // An event-storming board is always Diagram, whatever a stale mode says (the old opensInOf).
  if (body.kind === 'event-storming') return 'livediagram';
  if (body.opensIn === 'plan') return 'liveplanner';
  if (PAGES_MODES.has(body.opensIn)) return 'pages';
  return 'livediagram';
}

export const isTabWindow = (el: Rec) => el.type === 'shape' && el.shape === 'tab-window';
export const isPlanShape = (el: Rec) => el.type === 'shape' && PLAN_SHAPES.has(el.shape);
export const isArticleNote = (el: Rec) => el.type === 'annotation' && el.articleNote !== undefined;

/** Whether a raw stored tab holds anything livediagram no longer reads (Pages or Plan content), so it must be set
 *  aside before the editor reads it. Reads fields only, allocating nothing. */
export function hasRetiredContent(tab: unknown): boolean {
  if (!isRec(tab)) return false;
  if (PLAN_KINDS.has(tab.kind) || tab.opensIn === 'plan' || PAGES_MODES.has(tab.opensIn))
    return true;
  for (const k of PAGES_FIELDS) if (tab[k] !== undefined) return true;
  for (const k of PLAN_FIELDS) if (tab[k] !== undefined) return true;
  const elements = tab.elements;
  if (!Array.isArray(elements)) return false;
  for (const el of elements as unknown[]) {
    if (!isRec(el)) continue;
    if (el.type === 'shape' && (el.shape === 'tab-window' || PLAN_SHAPES.has(el.shape)))
      return true;
    if (el.type === 'annotation' && el.articleNote !== undefined) return true;
    if (el.chartSource !== undefined || el.sheetAnchor !== undefined) return true;
  }
  return false;
}

// ---- Addresses ---------------------------------------------------------------------------------------------------

/** Each app's own address, for a frozen reference's link when the hooks give no `partUrl`: the real domains (the
 *  migration lands at the switch, after which the stand-in addresses go). */
export const PART_ORIGINS: Readonly<Record<MigrationApp, string>> = {
  livediagram: 'https://www.livediagram.app',
  liveplanner: 'https://www.liveplanner.app',
  livedocuments: 'https://www.livedocuments.app',
  livedesign: 'https://www.livedesign.app',
};

// Where each app opens one item (@liveworkspace/sites APP_ITEMS itemPath); `#t=<tab id>` opens a tab.
const ITEM_PATHS: Readonly<Record<MigrationApp, string>> = {
  livediagram: '/document/',
  liveplanner: '/project/',
  livedocuments: '/document/',
  livedesign: '/design/',
};

export function defaultPartUrl(app: MigrationApp, id: string, tabId: string | null): string {
  const tab = tabId ? `#t=${encodeURIComponent(tabId)}` : '';
  return `${PART_ORIGINS[app]}${ITEM_PATHS[app]}${encodeURIComponent(id)}${tab}`;
}

// A link to another item of the same app, as that app stores one.
export function ownItemLink(app: MigrationApp, id: string, name: string): Rec {
  if (app === 'livedesign') return { kind: 'design', designId: id, name };
  if (app === 'liveplanner') return { kind: 'project', projectId: id, name };
  return { kind: 'document', documentId: id, name };
}

// ---- The source, as both entry points hand it in --------------------------------------------------------------------

export type SourceTab = {
  id: string;
  name: string;
  orderIndex: number;
  folder: string | null;
  addedAt: number;
  updatedAt: number;
  /** The raw body (the tab without id, name and folder), or null when it didn't parse. */
  body: Rec | null;
  /** The stored text, for a body that didn't parse: written through as it came. */
  data: string | null;
  elementCount: number | null;
  /** A Local only tab's own object, so an unchanged kept tab is handed back as it came. */
  local?: Rec;
};

export type Source = {
  id: string;
  name: string;
  oldOwnerId: string;
  teamId: string | null;
  source: string | null;
  presentation: string | null;
  savedAt: number;
  createdAt: number;
  opensIn: string | null;
  tabKind: string | null;
  tabs: SourceTab[];
  plan: MigrationPlanData | null;
  changesets: MigrationChangeset[];
  imageGrants: { imageId: string; createdAt: number }[];
  people: string[];
  /** Local only: livediagram's tabs stay in the browser (raw, not upgraded) and every part gets a fresh id. */
  local: boolean;
};

// ---- Drafts: each tab, or each half of a split tab, before its elements are settled --------------------------------

export type Draft = {
  app: MigrationApp;
  source: SourceTab;
  /** The tab's id in its part: the old id, or a fresh one for the half of a split tab that doesn't keep it. */
  id: string;
  body: Rec | null;
  /** A Pages tab split by page: this half's elements, by id, are found through `Split.elementApp`. */
  split: boolean;
};

export type Split = {
  // old tab id -> app -> the tab's id in that app's part
  tabApps: Map<string, Map<MigrationApp, string>>;
  // old tab id -> the app and id that keep it (changesets, and links from elsewhere, go there)
  tabHome: Map<string, { app: MigrationApp; tabId: string }>;
  // split tabs only: old tab id -> element id -> the app its half went to
  elementApp: Map<string, Map<string, MigrationApp>>;
};

export function intentOf(
  app: MigrationApp,
  src: Source,
): { opensIn: string | null; tabKind: string | null } {
  const { opensIn, tabKind } = src;
  if (app === 'livediagram') {
    return {
      opensIn: DIAGRAM_MODES.has(opensIn) ? opensIn : null,
      tabKind: DIAGRAM_KINDS.has(tabKind) ? tabKind : null,
    };
  }
  if (app === 'liveplanner') {
    return {
      opensIn: opensIn === 'plan' || PLAN_KINDS.has(tabKind) ? 'plan' : null,
      tabKind: PLAN_KINDS.has(tabKind) ? tabKind : null,
    };
  }
  return { opensIn: PAGES_MODES.has(opensIn) ? 'pages' : null, tabKind: null };
}

export const emptyPlan = (): MigrationPlanData => ({
  itemTypes: null,
  itemTypesRev: 0,
  itemsRev: 0,
  itemsNextKey: 1,
  items: [],
  sheets: [],
  cells: [],
  formLinks: [],
});

// The images a tab places: `$.elements[type=image].imageId` and `$.pages[].background.fill.imageId`.
export function collectImages(body: Rec, into: Set<string>) {
  if (Array.isArray(body.elements)) {
    for (const el of body.elements as unknown[]) {
      if (isRec(el) && el.type === 'image' && typeof el.imageId === 'string' && el.imageId)
        into.add(el.imageId);
    }
  }
  if (Array.isArray(body.pages)) {
    for (const page of body.pages as unknown[]) {
      const fill = isRec(page) && isRec(page.background) ? page.background.fill : undefined;
      if (isRec(fill) && typeof fill.imageId === 'string' && fill.imageId) into.add(fill.imageId);
    }
  }
}

export function parseBody(data: string): Rec | null {
  try {
    const parsed: unknown = JSON.parse(data);
    return isRec(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
