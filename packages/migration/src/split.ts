// The splitter (docs/migration.md, step 3 and "Tooling"): one old livediagram document in, one payload per app out.
// Pure; everything product-specific comes in through SplitHooks. Linear in the document's size: each tab body is
// parsed once, walked a fixed number of times, and written once. The rules are in this package's README.
import type {
  CrossReference,
  LocalDocumentInput,
  LocalSplitResult,
  MigrationApp,
  MigrationChangeset,
  MigrationPlanData,
  MigrationRoomPayload,
  MigrationTab,
  MovedParts,
  OldDocumentInput,
  SplitHooks,
  SplitResult,
} from './contract';
import { MIGRATION_APPS } from './contract';
import { PageIndex, type PageRect } from './page-index';
import { personIdMap, plannerItemPersonId, remapPlanPeople } from './person-ids';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown, fallback: number): number =>
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
const PAGES_FIELDS = ['pages', 'articles', 'pageOrientation'] as const;
const PLAN_FIELDS = ['dashboard', 'form'] as const;
// A chart's fields that read a sheet.
const CHART_SHEET_FIELDS = ['chartSource', 'sheetAnchor'] as const;
// Page kinds by the app that now owns them. A page with no kind is an infographic nobody chose yet. livedesign also
// has photo pages, which the old site never had; one is routed there all the same.
const DESIGN_PAGE_KINDS: ReadonlySet<unknown> = new Set(['logo', 'wireframe', 'photo']);
const DOCUMENT_PAGE_KINDS: ReadonlySet<unknown> = new Set([
  undefined,
  'infographic',
  'article',
  'slide',
]);
// The modes a livediagram document's intent may name.
const DIAGRAM_MODES: ReadonlySet<unknown> = new Set(['diagram', 'draw', 'workshop', 'facilitate']);
const DIAGRAM_KINDS: ReadonlySet<unknown> = new Set(['diagram', 'event-storming', 'whiteboard']);

type TabClass = 'livediagram' | 'liveplanner' | 'pages';
type Family = 'livedocuments' | 'livedesign';

function classify(body: Rec): TabClass {
  if (PLAN_KINDS.has(body.kind)) return 'liveplanner';
  // An event-storming board is always Diagram, whatever a stale mode says (the old opensInOf).
  if (body.kind === 'event-storming') return 'livediagram';
  if (body.opensIn === 'plan') return 'liveplanner';
  if (PAGES_MODES.has(body.opensIn)) return 'pages';
  return 'livediagram';
}

const isTabWindow = (el: Rec) => el.type === 'shape' && el.shape === 'tab-window';
const isPlanShape = (el: Rec) => el.type === 'shape' && PLAN_SHAPES.has(el.shape);
const isArticleNote = (el: Rec) => el.type === 'annotation' && el.articleNote !== undefined;

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
function ownItemLink(app: MigrationApp, id: string, name: string): Rec {
  if (app === 'livedesign') return { kind: 'design', designId: id, name };
  if (app === 'liveplanner') return { kind: 'project', projectId: id, name };
  return { kind: 'document', documentId: id, name };
}

// ---- The source, as both entry points hand it in --------------------------------------------------------------------

type SourceTab = {
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

type Source = {
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

type Draft = {
  app: MigrationApp;
  source: SourceTab;
  /** The tab's id in its part: the old id, or a fresh one for the half of a split tab that doesn't keep it. */
  id: string;
  body: Rec | null;
  /** A Pages tab split by page: this half's elements, by id, are found through `Split.elementApp`. */
  split: boolean;
};

type Split = {
  // old tab id -> app -> the tab's id in that app's part
  tabApps: Map<string, Map<MigrationApp, string>>;
  // old tab id -> the app and id that keep it (changesets, and links from elsewhere, go there)
  tabHome: Map<string, { app: MigrationApp; tabId: string }>;
  // split tabs only: old tab id -> element id -> the app its half went to
  elementApp: Map<string, Map<string, MigrationApp>>;
};

const familyOf = (page: unknown): Family | null => {
  const kind = isRec(page) ? page.kind : undefined;
  if (DESIGN_PAGE_KINDS.has(kind)) return 'livedesign';
  if (DOCUMENT_PAGE_KINDS.has(kind)) return 'livedocuments';
  return null;
};

// An element's centre, for the page it sits on; an arrow's comes from its ends (below).
function boxCentre(el: Rec): [number, number] | null {
  const { x, y, width, height } = el;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  return [x + num(width, 0) / 2, y + num(height, 0) / 2];
}

function freePoint(end: unknown): [number, number] | null {
  if (!isRec(end) || end.kind !== 'free') return null;
  return typeof end.x === 'number' && typeof end.y === 'number' ? [end.x, end.y] : null;
}

function translated(el: Rec, dx: number, dy: number): Rec {
  if (el.type === 'arrow') {
    const move = (end: unknown) =>
      isRec(end) && end.kind === 'free' && typeof end.x === 'number' && typeof end.y === 'number'
        ? { ...end, x: end.x + dx, y: end.y + dy }
        : end;
    return { ...el, from: move(el.from), to: move(el.to) };
  }
  if (typeof el.x !== 'number' || typeof el.y !== 'number') return el;
  return { ...el, x: el.x + dx, y: el.y + dy };
}

type Half = { body: Rec; pages: number; elementIds: string[] };

// A Pages tab with pages of both families, split by page: each element goes with the page its centre is on (an arrow
// with the element it is pinned to, else its ends' midpoint), an element on no page, and every article margin note,
// with the documents half. Articles follow their pages. Each half's pages are laid out again by the app's own rule, so
// an element moves by as much as its page did, and keeps its place on the page.
function splitPagesTab(body: Rec, hooks: SplitHooks): Map<Family, Half> {
  const pages = body.pages as unknown[];
  const pageFamily = new Map<string, Family>();
  for (const page of pages) {
    if (isRec(page) && typeof page.id === 'string')
      pageFamily.set(page.id, familyOf(page) ?? 'livedocuments');
  }
  const oldRects = new Map<string, PageRect>();
  for (const r of hooks.pageRects(body)) oldRects.set(r.pageId, r);
  const index = new PageIndex([...oldRects.values()]);

  const elements = Array.isArray(body.elements) ? (body.elements as unknown[]) : [];
  const pageOf: (string | null)[] = new Array<string | null>(elements.length).fill(null);
  const famOf: Family[] = new Array<Family>(elements.length).fill('livedocuments');
  const byId = new Map<string, number>();
  const resolved: boolean[] = new Array<boolean>(elements.length).fill(false);

  const place = (i: number, page: string | null) => {
    const fam = page ? (pageFamily.get(page) ?? 'livedocuments') : 'livedocuments';
    pageOf[i] = page;
    famOf[i] = fam;
    resolved[i] = true;
  };

  // Boxed elements first: arrows follow what they're pinned to.
  elements.forEach((el, i) => {
    if (!isRec(el)) {
      resolved[i] = true;
      return;
    }
    if (typeof el.id === 'string') byId.set(el.id, i);
    if (el.type === 'arrow') return;
    const c = boxCentre(el);
    const page = c ? index.pageAt(c[0], c[1]) : null;
    if (isArticleNote(el)) {
      // A margin note belongs beside its article, which is the documents half's.
      place(i, page && pageFamily.get(page) === 'livedocuments' ? page : null);
      return;
    }
    place(i, page);
  });
  const anchorOf = (end: unknown): number | undefined => {
    if (!isRec(end)) return undefined;
    const id =
      end.kind === 'pinned' ? end.elementId : end.kind === 'on-arrow' ? end.arrowId : undefined;
    const at = typeof id === 'string' ? byId.get(id) : undefined;
    return at !== undefined && resolved[at] ? at : undefined;
  };
  // Arrows on arrows resolve once the arrow they sit on has; two passes settle any chain the old editor made, and
  // whatever is left goes by its ends' midpoint.
  for (let pass = 0; pass < 2; pass++) {
    elements.forEach((el, i) => {
      if (resolved[i] || !isRec(el)) return;
      const at = anchorOf(el.from) ?? anchorOf(el.to);
      if (at !== undefined) {
        pageOf[i] = pageOf[at]!;
        famOf[i] = famOf[at]!;
        resolved[i] = true;
      }
    });
  }
  elements.forEach((el, i) => {
    if (resolved[i] || !isRec(el)) return;
    const a = freePoint(el.from);
    const b = freePoint(el.to);
    const c = a && b ? ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const) : (a ?? b);
    place(i, c ? index.pageAt(c[0], c[1]) : null);
  });

  // The row's anchor (where the first page's centre sits) rides on one page; a half that lost it takes it on its own
  // first page, so it starts where the row did.
  const rowAt = (pages.find((p) => isRec(p) && p.rowAt !== undefined) as Rec | undefined)?.rowAt;
  const articles = isRec(body.articles) ? body.articles : undefined;
  // The articles the design pages show (none, in practice: article pages are documents'); every other article, shown
  // or not, stays with the documents half.
  const designFlows = new Set<unknown>();
  for (const p of pages) {
    if (isRec(p) && typeof p.id === 'string' && pageFamily.get(p.id) === 'livedesign')
      designFlows.add(p.flow);
  }
  const halves = new Map<Family, Half>();
  for (const fam of ['livedocuments', 'livedesign'] as const) {
    let halfPages = pages.filter(
      (p) => isRec(p) && typeof p.id === 'string' && pageFamily.get(p.id) === fam,
    );
    if (rowAt !== undefined && !halfPages.some((p) => isRec(p) && p.rowAt !== undefined)) {
      halfPages = [{ ...(halfPages[0] as Rec), rowAt }, ...halfPages.slice(1)];
    }
    const halfArticles: Rec = {};
    let anyArticle = false;
    if (articles) {
      for (const key in articles) {
        if (designFlows.has(key) === (fam === 'livedesign')) {
          halfArticles[key] = articles[key];
          anyArticle = true;
        }
      }
    }
    const halfElements: unknown[] = [];
    const elementIds: string[] = [];
    elements.forEach((el, i) => {
      if (famOf[i] !== fam) return;
      halfElements.push(el);
      if (isRec(el) && typeof el.id === 'string') elementIds.push(el.id);
    });
    const halfBody: Rec = { ...body, pages: halfPages, elements: halfElements };
    if (anyArticle) halfBody.articles = halfArticles;
    else delete halfBody.articles;
    halves.set(fam, { body: halfBody, pages: halfPages.length, elementIds });
  }

  // Each half laid out by itself: move every element on a page by as much as its page moved.
  for (const [fam, half] of halves) {
    const newRects = new Map<string, PageRect>();
    for (const r of hooks.pageRects(half.body)) newRects.set(r.pageId, r);
    const halfElements = half.body.elements as unknown[];
    let k = 0;
    elements.forEach((el, i) => {
      if (famOf[i] !== fam) return;
      const at = k++;
      const page = pageOf[i];
      if (!page || !isRec(el)) return;
      const before = oldRects.get(page);
      const after = newRects.get(page);
      if (!before || !after) return;
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      if (dx !== 0 || dy !== 0) halfElements[at] = translated(el, dx, dy);
    });
  }
  return halves;
}

// ---- The core ------------------------------------------------------------------------------------------------------

type CoreResult = {
  payloads: Map<MigrationApp, MigrationRoomPayload>;
  order: MigrationApp[];
  keeper: MigrationApp;
  keep: unknown[];
  crossReferences: CrossReference[];
  notes: string[];
};

function splitCore(src: Source, hooks: SplitHooks): CoreResult {
  const notes: string[] = [];
  const note = (text: string) => notes.push(text);
  const crossReferences: CrossReference[] = [];
  const drafts: Draft[] = [];
  const split: Split = { tabApps: new Map(), tabHome: new Map(), elementApp: new Map() };
  const addDraft = (draft: Draft, home: boolean) => {
    drafts.push(draft);
    const apps = split.tabApps.get(draft.source.id) ?? new Map<MigrationApp, string>();
    apps.set(draft.app, draft.id);
    split.tabApps.set(draft.source.id, apps);
    if (home) split.tabHome.set(draft.source.id, { app: draft.app, tabId: draft.id });
  };

  // 1. Each tab to its app, or split by page.
  for (const tab of src.tabs) {
    const raw = tab.body;
    if (!raw) {
      note(`tab ${tab.id}: its body is not JSON; kept in livediagram as stored`);
      addDraft({ app: 'livediagram', source: tab, id: tab.id, body: null, split: false }, true);
      continue;
    }
    const cls = classify(raw);
    // livediagram's own tabs on a Local only document stay in the browser, which runs its own read migrations.
    const body = src.local && cls === 'livediagram' ? raw : hooks.upgradeTab(raw);
    if (cls !== 'pages') {
      addDraft({ app: cls, source: tab, id: tab.id, body, split: false }, true);
      continue;
    }
    const pages = Array.isArray(body.pages) ? (body.pages as unknown[]) : [];
    const families = new Set<Family>();
    for (const page of pages) {
      const fam = familyOf(page);
      if (fam === null) {
        note(
          `tab ${tab.id}: page ${String(isRec(page) ? page.id : page)} has an unknown kind ` +
            `(${JSON.stringify(isRec(page) ? page.kind : null)}); read as a documents page`,
        );
      }
      families.add(fam ?? 'livedocuments');
    }
    // No stored pages is one infographic page (the old pagesOf), legacy orientation included.
    if (families.size === 0) families.add('livedocuments');
    if (families.size === 1) {
      const [fam] = families as Set<Family> & Iterable<Family>;
      addDraft({ app: fam!, source: tab, id: tab.id, body, split: false }, true);
      continue;
    }
    const halves = splitPagesTab(body, hooks);
    const docs = halves.get('livedocuments')!;
    const design = halves.get('livedesign')!;
    // The half with more pages keeps the tab's id (the documents half on a tie); the other gets a fresh one.
    const homeFam: Family = design.pages > docs.pages ? 'livedesign' : 'livedocuments';
    const elementApp = new Map<string, MigrationApp>();
    for (const [fam, half] of halves) {
      for (const id of half.elementIds) elementApp.set(id, fam);
      const id = fam === homeFam ? tab.id : hooks.newId(`${src.id}:${tab.id}:${fam}`);
      addDraft({ app: fam, source: tab, id, body: half.body, split: true }, fam === homeFam);
    }
    split.elementApp.set(tab.id, elementApp);
    note(
      `tab ${tab.id}: split by page, ${docs.pages} page(s) to livedocuments and ${design.pages} to livedesign`,
    );
  }

  // 2. The parts: one per app with content, and which keeps the old id.
  const tabsPerApp = new Map<MigrationApp, number>();
  for (const d of drafts) tabsPerApp.set(d.app, (tabsPerApp.get(d.app) ?? 0) + 1);
  const plan = src.plan;
  const planHasContent =
    !!plan && (plan.items.length > 0 || plan.sheets.length > 0 || plan.formLinks.length > 0);
  if (!tabsPerApp.has('liveplanner') && plan && plan.items.length > 0) {
    tabsPerApp.set('liveplanner', 0);
    note('cards with no Plan tab: a liveplanner part with no tabs carries them');
  }
  if (tabsPerApp.size === 0) tabsPerApp.set('livediagram', 0);
  let keeper: MigrationApp;
  if (src.local || tabsPerApp.has('livediagram')) keeper = 'livediagram';
  else {
    keeper = MIGRATION_APPS.filter((a) => tabsPerApp.has(a)).reduce((best, a) =>
      (tabsPerApp.get(a) ?? 0) > (tabsPerApp.get(best) ?? 0) ? a : best,
    );
  }
  const order = [keeper, ...MIGRATION_APPS.filter((a) => a !== keeper && tabsPerApp.has(a))];
  const partIds = new Map<MigrationApp, string>();
  for (const app of order) {
    partIds.set(app, app === keeper && !src.local ? src.id : hooks.newId(`${src.id}:${app}`));
  }
  if (src.local) partIds.set('livediagram', src.id);

  const partUrl = (app: MigrationApp, id: string, tabId: string | null) =>
    hooks.partUrl ? hooks.partUrl(app, id, tabId) : defaultPartUrl(app, id, tabId);
  const plannerTabs = new Set(
    drafts.filter((d) => d.app === 'liveplanner').map((d) => d.source.id),
  );
  const sheetTab = new Map<string, string>();
  for (const s of plan?.sheets ?? []) sheetTab.set(s.id, s.tabId);
  const hasPlanner = partIds.has('liveplanner');

  // 3. Each draft's elements settled for its app.
  const resolveTab = (
    oldTabId: string,
    fromApp: MigrationApp,
    elementId?: string,
  ): { app: MigrationApp; tabId: string } | null => {
    const apps = split.tabApps.get(oldTabId);
    if (!apps) return null;
    const byElement = elementId ? split.elementApp.get(oldTabId)?.get(elementId) : undefined;
    if (byElement) return { app: byElement, tabId: apps.get(byElement)! };
    const here = apps.get(fromApp);
    if (here !== undefined) return { app: fromApp, tabId: here };
    return split.tabHome.get(oldTabId) ?? null;
  };
  const urlLink = (app: MigrationApp, tabId: string | null) => ({
    kind: 'url',
    url: partUrl(app, partIds.get(app)!, tabId),
  });

  const settle = (draft: Draft): Rec | null => {
    const body = draft.body;
    if (!body) return null;
    const app = draft.app;
    const at = (elementId: string) => ({ app, id: partIds.get(app)!, tabId: draft.id, elementId });
    const tag = `tab ${draft.source.id}${draft.split ? ` (${app} half)` : ''}`;
    let out = body;
    const set = (k: string, v: unknown) => {
      if (out === body) out = { ...body };
      if (v === undefined) delete out[k];
      else out[k] = v;
    };

    // Tab fields the app doesn't read.
    if (app === 'livediagram') {
      const pages = Array.isArray(body.pages) ? body.pages.length : 0;
      for (const k of PAGES_FIELDS) if (k in body) set(k, undefined);
      if (pages > 0)
        note(
          `${tag}: ${pages} page(s) kept from an earlier Pages mode dropped (a Diagram tab has none)`,
        );
    }
    if (app !== 'liveplanner') {
      for (const k of PLAN_FIELDS) {
        if (k in body) {
          set(k, undefined);
          note(`${tag}: its ${k} dropped (only a Plan tab has one)`);
        }
      }
    }
    if ((app === 'livedocuments' || app === 'livedesign') && body.opensIn !== 'pages')
      set('opensIn', 'pages');

    const link = (value: unknown, elementId: string): unknown => {
      if (!isRec(value)) return value;
      if (value.kind === 'tab' || value.kind === 'element') {
        const tabId = str(value.tabId);
        if (!tabId) return value;
        const target = resolveTab(
          tabId,
          app,
          value.kind === 'element' ? str(value.elementId) : undefined,
        );
        if (!target) return value;
        if (target.app === app)
          return target.tabId === tabId ? value : { ...value, tabId: target.tabId };
        crossReferences.push({
          from: at(elementId),
          to: { app: target.app, id: partIds.get(target.app)!, tabId: target.tabId },
          kind: 'link',
        });
        return urlLink(target.app, target.tabId);
      }
      if (value.kind === 'document' || value.kind === 'design' || value.kind === 'project') {
        const documentId = str(value.documentId) ?? str(value.designId) ?? str(value.projectId);
        if (!documentId) return value;
        const name = str(value.name) ?? '';
        if (documentId === src.id) {
          // A link to this very document: to whichever part kept its id (the browser's own copy when Local only).
          if (keeper === app) return ownItemLink(app, partIds.get(app)!, name);
          crossReferences.push({
            from: at(elementId),
            to: { app: keeper, id: partIds.get(keeper)!, tabId: null },
            kind: 'link',
          });
          return urlLink(keeper, null);
        }
        const target = hooks.keptByOf?.(documentId) ?? 'livediagram';
        if (target === app) {
          const own = ownItemLink(app, documentId, name);
          return own.kind === value.kind ? value : own;
        }
        return { kind: 'url', url: partUrl(target, documentId, null) };
      }
      return value;
    };

    // A frozen reference: the element becomes a picture slot (an image with no image yet, which every app draws as
    // a placeholder until the migrate tool draws the picture in) linking to where the content went.
    const freeze = (
      el: Rec,
      kind: CrossReference['kind'],
      to: { app: MigrationApp; tabId: string | null },
      picture: { tabId: string; elementId: string | null },
    ): Rec => {
      const id = el.id as string;
      const slot: Rec = {
        id,
        type: 'image',
        x: num(el.x, 0),
        y: num(el.y, 0),
        width: num(el.width, 640),
        height: num(el.height, 360),
        imageId: null,
        objectFit: 'contain',
        // Within the part, an ordinary tab link; to another app, its address.
        link:
          to.app === app && to.tabId ? { kind: 'tab', tabId: to.tabId } : urlLink(to.app, to.tabId),
      };
      for (const k of ['layerId', 'rotation', 'locked', 'opacity'] as const) {
        if (el[k] !== undefined) slot[k] = el[k];
      }
      if (typeof el.label === 'string' && el.label) slot.alt = el.label;
      crossReferences.push({
        from: at(id),
        to: { app: to.app, id: partIds.get(to.app)!, tabId: to.tabId },
        kind,
        picture,
      });
      return slot;
    };

    const elements = Array.isArray(body.elements) ? (body.elements as unknown[]) : null;
    if (elements) {
      let next: unknown[] | null = null;
      for (let i = 0; i < elements.length; i++) {
        const el0 = elements[i];
        if (!isRec(el0) || typeof el0.id !== 'string') {
          if (next) next.push(el0);
          continue;
        }
        const id = el0.id;
        let el: Rec | null = el0;

        if (isTabWindow(el)) {
          const shown = str(el.windowTabId);
          const target = shown ? resolveTab(shown, app) : null;
          if (target && target.app === app && app !== 'livediagram') {
            if (target.tabId !== shown) el = { ...el, windowTabId: target.tabId };
          } else if (target && shown) {
            el = freeze(el, 'tab-window', target, { tabId: shown, elementId: null });
          } else if (app === 'livediagram') {
            el = null;
            note(`${tag}: a tab window onto no tab dropped`);
          }
        } else if (isPlanShape(el)) {
          if (app !== 'liveplanner') {
            if (hasPlanner) {
              const sheetId = isRec(el.planSheet) ? str(el.planSheet.sheetId) : undefined;
              const sheetOn = sheetId ? sheetTab.get(sheetId) : undefined;
              const tabId = sheetOn && plannerTabs.has(sheetOn) ? sheetOn : null;
              el = freeze(
                el,
                'plan-element',
                { app: 'liveplanner', tabId },
                { tabId: draft.source.id, elementId: id },
              );
            } else {
              el = null;
              note(`${tag}: a ${String(el0.shape)} with no Plan data behind it dropped`);
            }
          }
        } else if (isArticleNote(el) && app !== 'livedocuments') {
          el = null;
          note(`${tag}: an article margin note dropped (only livedocuments has articles)`);
        }

        if (el && (el.chartSource !== undefined || el.sheetAnchor !== undefined)) {
          const sheetId = isRec(el.chartSource) ? str(el.chartSource.sheetId) : undefined;
          const sheetOn = sheetId ? sheetTab.get(sheetId) : undefined;
          const readable = !!sheetOn && plannerTabs.has(sheetOn);
          if (app !== 'liveplanner' || (el.chartSource !== undefined && !readable)) {
            // The chart keeps its last read values as its own (as livediagram's read does) and links to its sheet.
            const kept: Rec = { ...el };
            for (const k of CHART_SHEET_FIELDS) delete kept[k];
            if (readable && hasPlanner) {
              crossReferences.push({
                from: at(id),
                to: { app: 'liveplanner', id: partIds.get('liveplanner')!, tabId: sheetOn },
                kind: 'chart-source',
              });
              if (kept.link === undefined) kept.link = urlLink('liveplanner', sheetOn);
            } else if (el.chartSource !== undefined) {
              note(`${tag}: chart ${id} read a sheet that didn't move; it keeps its last values`);
            }
            el = kept;
          }
        }

        if (el && el.link !== undefined) {
          const l = link(el.link, id);
          if (l !== el.link) el = { ...el, link: l };
        }
        if (el && el.type === 'table' && Array.isArray(el.cellStyles)) {
          let rows: unknown[] | null = null;
          (el.cellStyles as unknown[]).forEach((row, r) => {
            if (!Array.isArray(row)) return;
            let cells: unknown[] | null = null;
            row.forEach((cell: unknown, c: number) => {
              if (!isRec(cell) || cell.link === undefined) return;
              const l = link(cell.link, id);
              if (l === cell.link) return;
              cells ??= row.slice();
              cells[c] = { ...cell, link: l };
            });
            if (cells) {
              rows ??= (el!.cellStyles as unknown[]).slice();
              rows[r] = cells;
            }
          });
          if (rows) el = { ...el, cellStyles: rows };
        }

        if (el !== el0 && !next) next = elements.slice(0, i);
        if (next && el) next.push(el);
      }
      if (next) set('elements', next);
    }
    return out;
  };

  // 4. Payloads.
  const owner = hooks.ownerOf(src.oldOwnerId);
  const grantAt = new Map(src.imageGrants.map((g) => [g.imageId, g.createdAt]));
  const payloads = new Map<MigrationApp, MigrationRoomPayload>();
  const keep: unknown[] = [];
  // The slide deck goes where decks are still kept: livediagram and livedocuments (livedesign has none since
  // 25 October 2026). The kept part first, then livediagram's, then livedocuments'.
  const presentationApp: MigrationApp | null =
    keeper === 'livediagram' || keeper === 'livedocuments'
      ? keeper
      : partIds.has('livediagram')
        ? 'livediagram'
        : partIds.has('livedocuments')
          ? 'livedocuments'
          : null;
  if (src.presentation && !presentationApp)
    note('its slide deck had no part to go to (no livediagram or livedocuments part); dropped');

  for (const app of order) {
    if (src.local && app === 'livediagram') continue;
    payloads.set(app, {
      v: 1,
      app,
      id: partIds.get(app)!,
      name: src.name,
      ownerId: owner,
      teamId: src.teamId,
      createdAt: src.createdAt,
      savedAt: src.savedAt,
      source: src.source,
      presentation: app === presentationApp ? src.presentation : null,
      ...intentOf(app, src),
      tabs: [],
      changesets: [],
      imageGrants: [],
      imageOwners: [],
      plan: null,
    });
  }
  const images = new Map<MigrationApp, Set<string>>();
  for (const draft of drafts) {
    const body = settle(draft);
    if (src.local && draft.app === 'livediagram') {
      const t = draft.source;
      keep.push(
        body === draft.body && t.local
          ? t.local
          : {
              id: t.id,
              name: t.name,
              ...(t.local && 'folder' in t.local ? { folder: t.local.folder } : {}),
              ...body,
            },
      );
      continue;
    }
    const payload = payloads.get(draft.app)!;
    const elements = body && Array.isArray(body.elements) ? body.elements : null;
    const tab: MigrationTab = {
      id: draft.id,
      name: draft.source.name,
      orderIndex: draft.source.orderIndex,
      folder: draft.source.folder,
      addedAt: draft.source.addedAt,
      updatedAt: draft.source.updatedAt,
      data: body ? JSON.stringify(body) : (draft.source.data ?? '{}'),
      elementCount: elements ? elements.length : (draft.source.elementCount ?? 0),
    };
    payload.tabs.push(tab);
    if (body) {
      const set = images.get(draft.app) ?? new Set<string>();
      collectImages(body, set);
      images.set(draft.app, set);
    }
  }

  // Changesets go with their tab (to the half that kept a split tab's id).
  for (const cs of src.changesets) {
    const home = split.tabHome.get(cs.tabId);
    const payload = payloads.get(home?.app ?? keeper);
    if (!payload) continue;
    if (!home)
      note(`changeset ${cs.id}: its tab ${cs.tabId} is gone; kept with the ${keeper} part`);
    payload.changesets.push(cs);
  }

  // Images each part places: its owners, and a grant for each its owner didn't upload.
  const unknownImages = new Set<string>();
  for (const [app, set] of images) {
    const payload = payloads.get(app);
    if (!payload) continue;
    for (const imageId of set) {
      const imageOwner = hooks.imageOwner(imageId);
      if (imageOwner === null) unknownImages.add(imageId);
      else payload.imageOwners.push({ imageId, owner: imageOwner });
      const granted = grantAt.get(imageId);
      if (granted !== undefined) payload.imageGrants.push({ imageId, createdAt: granted });
      else if (imageOwner !== null && imageOwner !== payload.ownerId) {
        payload.imageGrants.push({ imageId, createdAt: src.createdAt });
      }
    }
  }
  for (const imageId of unknownImages)
    note(`image ${imageId} is placed but unknown to the media copy`);

  // Plan's rows, for the liveplanner part: every card, and the sheets and form links of its tabs.
  const planner = payloads.get('liveplanner');
  if (planner) {
    if (plan) {
      const sheets = plan.sheets.filter((s) => plannerTabs.has(s.tabId));
      const sheetIds = new Set(sheets.map((s) => s.id));
      for (const s of plan.sheets) {
        if (!sheetIds.has(s.id))
          note(`sheet ${s.id} sits on tab ${s.tabId}, which isn't a Plan tab; dropped`);
      }
      const formLinks = plan.formLinks.filter((f) => plannerTabs.has(f.tabId));
      for (const f of plan.formLinks) {
        if (!plannerTabs.has(f.tabId))
          note(`form link ${f.code} on tab ${f.tabId}, which isn't a Plan tab; dropped`);
      }
      const people = new Set([src.oldOwnerId, ...src.people]);
      const map = personIdMap(
        people,
        (old) => hooks.ownerOf(old),
        (owner) => (hooks.itemPersonId ? hooks.itemPersonId(owner) : plannerItemPersonId(owner)),
      );
      const remapped = remapPlanPeople(
        {
          ...plan,
          sheets,
          cells: plan.cells.filter((c) => sheetIds.has(c.sheetId)),
          formLinks,
        },
        map,
      );
      if (remapped.unmatched > 0) {
        note(
          `${remapped.unmatched} card or sheet person id(s) matched nobody named; kept as they were`,
        );
      }
      planner.plan = remapped.plan;
    } else {
      planner.plan = emptyPlan();
      if (src.local)
        note(
          'no Plan data came with the local record; the liveplanner part has no cards or sheets',
        );
    }
  } else if (planHasContent) {
    note('Plan data with no liveplanner part (no Plan tab, no cards); dropped');
  }

  return { payloads, order, keeper, keep, crossReferences, notes };
}

function intentOf(
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

const emptyPlan = (): MigrationPlanData => ({
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
function collectImages(body: Rec, into: Set<string>) {
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

function parseBody(data: string): Rec | null {
  try {
    const parsed: unknown = JSON.parse(data);
    return isRec(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ---- Entry points ------------------------------------------------------------------------------------------------

/** Splits one old document from the server snapshot into its parts. */
export function splitOldDocument(input: OldDocumentInput, hooks: SplitHooks): SplitResult {
  const doc = input.document;
  const result = splitCore(
    {
      id: doc.id,
      name: doc.name,
      oldOwnerId: doc.ownerId,
      teamId: doc.teamId,
      source: doc.source,
      presentation: doc.presentation,
      savedAt: doc.savedAt,
      createdAt: doc.createdAt,
      opensIn: doc.opensIn,
      tabKind: doc.tabKind,
      tabs: input.tabs.map((t) => {
        const body = parseBody(t.data);
        return {
          id: t.id,
          name: t.name,
          orderIndex: t.orderIndex,
          folder: t.folder,
          addedAt: t.addedAt,
          updatedAt: t.updatedAt,
          body,
          data: body ? null : t.data,
          elementCount: t.elementCount,
        };
      }),
      plan: input.plan,
      changesets: input.changesets,
      imageGrants: input.imageGrants,
      people: input.people ?? [],
      local: false,
    },
    hooks,
  );
  const parts = result.order.map((app) => result.payloads.get(app)!);
  const moved: MovedParts | null =
    parts.length > 1
      ? {
          oldId: doc.id,
          keptBy: result.keeper,
          parts: parts.map((p) => ({ app: p.app, id: p.id, tabIds: p.tabs.map((t) => t.id) })),
        }
      : null;
  return { parts, moved, crossReferences: result.crossReferences, notes: result.notes };
}

/** Splits one Local only document from a browser's store: what stays local, and the parts for the other apps. */
export function splitLocalDocument(input: LocalDocumentInput, hooks: SplitHooks): LocalSplitResult {
  const notes: string[] = [];
  const at = num(input.savedAt, 0);
  const tabs: SourceTab[] = [];
  input.tabs.forEach((t, i) => {
    if (!isRec(t) || typeof t.id !== 'string') {
      notes.push(`local tab ${i} is not a tab; left out`);
      return;
    }
    const { id, name, folder, ...body } = t;
    tabs.push({
      id,
      name: str(name) ?? '',
      orderIndex: i,
      folder: str(folder) ?? null,
      addedAt: at,
      updatedAt: at,
      body,
      data: null,
      elementCount: null,
      local: t,
    });
  });
  const result = splitCore(
    {
      id: input.id,
      name: input.name,
      oldOwnerId: input.ownerId ?? '',
      teamId: null,
      source: null,
      presentation: input.presentation ?? null,
      savedAt: at,
      createdAt: num(input.createdAt, at),
      opensIn: null,
      tabKind: null,
      tabs,
      plan: localPlan(input),
      changesets: [],
      imageGrants: [],
      people: [],
      local: true,
    },
    hooks,
  );
  return {
    keep: result.keep,
    parts: result.order.filter((a) => a !== 'livediagram').map((app) => result.payloads.get(app)!),
    crossReferences: result.crossReferences,
    notes: [...notes, ...result.notes],
  };
}

const json = (v: unknown): string | null =>
  v === undefined || v === null ? null : JSON.stringify(v);

// A Local only record's item and sheet stores (the old offline record's `items`, `sheets`, ...) as Plan's rows, or null
// when it has neither.
function localPlan(input: LocalDocumentInput): MigrationPlanData | null {
  if (!Array.isArray(input.items) && !Array.isArray(input.sheets)) return null;
  const items = (input.items ?? []).filter(isRec).map((it) => ({
    id: str(it.id) ?? '',
    type: str(it.type) ?? '',
    itemKey: num(it.key, 0),
    rank: str(it.rank) ?? '',
    fields: JSON.stringify(isRec(it.fields) ? it.fields : {}),
    rev: num(it.rev, 0),
    createdAt: num(it.createdAt, 0),
    updatedAt: num(it.updatedAt, 0),
    createdBy: json(it.createdBy),
    updatedBy: json(it.updatedBy),
  }));
  const sheets: MigrationPlanData['sheets'] = [];
  const cells: MigrationPlanData['cells'] = [];
  for (const s of (input.sheets ?? []).filter(isRec)) {
    const id = str(s.id) ?? '';
    sheets.push({
      id,
      tabId: str(s.tabId) ?? '',
      title: str(s.title) ?? '',
      layout: JSON.stringify(s.layout ?? {}),
      rev: num(s.rev, 0),
      createdAt: num(s.createdAt, 0),
      updatedAt: num(s.updatedAt, 0),
      updatedBy: json(s.updatedBy),
    });
    for (const c of Array.isArray(s.cells) ? (s.cells as unknown[]) : []) {
      if (!isRec(c)) continue;
      cells.push({
        sheetId: id,
        rowId: str(c.r) ?? '',
        colId: str(c.c) ?? '',
        input: str(c.i) ?? null,
        format: c.f === undefined ? null : typeof c.f === 'string' ? c.f : JSON.stringify(c.f),
      });
    }
  }
  return {
    itemTypes: json(input.itemTypes),
    itemTypesRev: 0,
    itemsRev: num(input.itemsRev, 0),
    itemsNextKey: num(input.itemsNextKey, items.length + 1),
    items,
    sheets,
    cells,
    formLinks: [],
  };
}
