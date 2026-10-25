// Hand-written fixtures for the splitter's tests, in the old site's stored shapes (docs/migration.md, step 3): tab
// bodies as `tabs.data` held them, and hooks standing in for the products.
import type { MigrationPlanData, OldDocumentInput, SplitHooks } from './contract';

type Rec = Record<string, unknown>;

// Page sides by kind, as the old editor sized them (A4 at 96 dpi, a 16:9 slide, a logo artboard).
const SIDES: Record<string, [number, number]> = {
  slide: [1280, 720],
  logo: [512, 512],
  wireframe: [390, 844],
};
const A4: [number, number] = [794, 1123];
const GAP = 80;

/** Pages in one row from the row's anchor, each its kind's size: enough like the old layout for the split. */
export function rowRects(
  body: Rec,
): { pageId: string; x: number; y: number; width: number; height: number }[] {
  const pages = Array.isArray(body.pages) ? (body.pages as Rec[]) : [];
  const anchor = pages.find((p) => p.rowAt)?.rowAt as { x: number; y: number } | undefined;
  let x = anchor?.x ?? 0;
  const y = anchor?.y ?? 0;
  return pages.map((p) => {
    const [width, height] = SIDES[String(p.kind)] ?? A4;
    const rect = { pageId: String(p.id), x, y, width, height };
    x += width + GAP;
    return rect;
  });
}

export const OWNER = 'user_ali';
export const NEW_OWNER = 'acct_ali';

export function hooks(overrides: Partial<SplitHooks> = {}): SplitHooks {
  return {
    newId: (seed) => `new:${seed}`,
    ownerOf: (old) => (old === OWNER ? NEW_OWNER : old),
    // Marks what it saw, so a test can tell every written tab went through it.
    upgradeTab: (body) => ({ ...body, upgraded: true }),
    pageRects: rowRects,
    imageOwner: (id) =>
      id.startsWith('img-') ? NEW_OWNER : id.startsWith('ext-') ? 'acct_bo' : null,
    ...overrides,
  };
}

export const shape = (id: string, x: number, y: number, extra: Rec = {}): Rec => ({
  id,
  type: 'shape',
  shape: 'rectangle',
  x,
  y,
  width: 100,
  height: 60,
  ...extra,
});

export function doc(
  tabs: { id: string; body: Rec; name?: string }[],
  extra: Partial<OldDocumentInput> = {},
): OldDocumentInput {
  return {
    document: {
      id: 'doc1',
      ownerId: OWNER,
      name: 'Roadmap',
      teamId: 'team1',
      source: null,
      presentation: null,
      savedAt: 2000,
      createdAt: 1000,
      trashedAt: null,
      opensIn: null,
      tabKind: null,
      templateFamily: null,
    },
    tabs: tabs.map((t, i) => ({
      id: t.id,
      name: t.name ?? t.id,
      data: JSON.stringify(t.body),
      updatedAt: 1500 + i,
      orderIndex: i,
      addedAt: 1100 + i,
      folder: null,
      elementCount: Array.isArray(t.body.elements) ? t.body.elements.length : 0,
    })),
    plan: null,
    changesets: [],
    imageGrants: [],
    ...extra,
  };
}

export function plan(extra: Partial<MigrationPlanData> = {}): MigrationPlanData {
  return {
    itemTypes: null,
    itemTypesRev: 0,
    itemsRev: 3,
    itemsNextKey: 2,
    items: [],
    sheets: [],
    cells: [],
    formLinks: [],
    ...extra,
  };
}

export const diagramTab = (elements: Rec[] = [shape('s1', 0, 0)]): Rec => ({ elements });
export const boardTab = (): Rec => ({
  kind: 'board',
  opensIn: 'plan',
  elements: [{ ...shape('b1', 0, 0), shape: 'plan-board', planBoard: { columns: [] } }],
});
export const slideTab = (elements: Rec[] = []): Rec => ({
  opensIn: 'pages',
  pages: [{ id: 'p1', orientation: 'landscape', kind: 'slide', size: 'slide-16-9' }],
  elements,
});
