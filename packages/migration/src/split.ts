// The splitter (docs/migration.md, step 3 and "Tooling"): one old livediagram document in, one payload per app out.
// Pure; everything product-specific comes in through SplitHooks. Linear in the document's size: each tab body is
// parsed once, walked a fixed number of times, and written once. The rules are in this package's README.
import type {
  CrossReference,
  LocalDocumentInput,
  LocalSplitResult,
  MigrationApp,
  MigrationRoomPayload,
  MigrationTab,
  MovedParts,
  OldDocumentInput,
  SplitHooks,
  SplitResult,
} from './contract';
import { MIGRATION_APPS } from './contract';
import { personIdMap, plannerItemPersonId, remapPlanPeople } from './person-ids';
import { localPlan } from './split-local-plan';
import {
  classify,
  collectImages,
  defaultPartUrl,
  emptyPlan,
  intentOf,
  isRec,
  num,
  parseBody,
  str,
  type Draft,
  type Family,
  type Source,
  type SourceTab,
  type Split,
} from './split-model';
import { familyOf, splitPagesTab } from './split-pages';
import { makeSettle } from './split-settle';

export { defaultPartUrl, hasRetiredContent, PART_ORIGINS } from './split-model';

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

  const settle = makeSettle({
    src,
    hooks,
    keeper,
    partIds,
    note,
    crossReferences,
    resolveTab,
    urlLink,
    partUrl,
    hasPlanner,
    sheetTab,
    plannerTabs,
  });

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
