// The pictures frozen references keep (docs/migration.md, step 3: "each keeps its last picture"). The splitter turns
// a tab window onto a tab now in another part, and a Plan board, card, view or Sheet on a tab that left liveplanner,
// into a picture slot: an image element with `imageId: null` and a `CrossReference.picture` naming what to draw (the
// old tab whole, or one element of it). This draws each one from the old document's raw rows with liveplanner's
// renderer (the one that draws boards and cards from their items, and sheets from their cells, as the old site's
// exports did), rasterises it with @liveworkspace/render-png, and hands back PNG bytes the plan uploads as a media
// image of the part's owner.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  cardSourceOf,
  readItemTypeCatalogue,
  typesOf,
  type Item,
  type ItemPerson,
} from '@liveplanner/items';
import { migrateStoredTab, renderElementsToSvg, type Tab } from '@liveplanner/project';
import { renderModelsForTab, sheetFramesOf, type SheetJson } from '@liveplanner/sheets';
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import type { MigrationPlanData, OldDocumentInput } from '@liveworkspace/migration';
import { createPngRenderer } from '@liveworkspace/render-png';

export type Picture = { png: Uint8Array; width: number; height: number };

/** Draws a picture slot's content; null when there is nothing to draw (the tab or element is gone). */
export type PictureDrawer = (
  input: OldDocumentInput,
  picture: { tabId: string; elementId: string | null },
  upgradeTab: (body: Record<string, unknown>) => Record<string, unknown>,
) => Promise<Picture | null>;

// The longest side a picture is drawn at: a board can be very large, and a slot is a picture, not an export.
const MAX_SIDE = 2048;

const require = createRequire(import.meta.url);

const NOBODY: ItemPerson = { id: '', name: 'Someone', color: '#94a3b8' };

function parse<T>(text: string | null, fallback: T): T {
  if (text === null) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// The old rows as liveplanner's room reads its own (liveplanner/apps/api/src/db/items.ts itemFromRow, db/sheets.ts
// headToJson): the same columns, so the same reading.
function itemsOf(plan: MigrationPlanData): Map<string, Item> {
  const person = (text: string | null): ItemPerson => {
    const p = parse<Partial<ItemPerson>>(text, {});
    return typeof p.id === 'string' && typeof p.name === 'string' && typeof p.color === 'string'
      ? { id: p.id, name: p.name, color: p.color }
      : NOBODY;
  };
  return new Map(
    plan.items.map((r) => [
      r.id,
      {
        id: r.id,
        type: r.type,
        key: r.itemKey,
        rank: r.rank,
        fields: parse<Item['fields']>(r.fields, {}),
        rev: r.rev,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: person(r.createdBy),
        updatedBy: person(r.updatedBy),
      },
    ]),
  );
}

function sheetsOf(plan: MigrationPlanData, ids: ReadonlySet<string>): unknown[] {
  // One pass over the cells, keeping only the drawn sheets'.
  const cellsBy = new Map<string, MigrationPlanData['cells']>();
  for (const c of plan.cells) {
    if (!ids.has(c.sheetId)) continue;
    const list = cellsBy.get(c.sheetId);
    if (list) list.push(c);
    else cellsBy.set(c.sheetId, [c]);
  }
  return plan.sheets
    .filter((s) => ids.has(s.id))
    .map((s) => ({
      id: s.id,
      tabId: s.tabId,
      title: s.title,
      layout: parse(s.layout, { rows: [], cols: [] }),
      rev: s.rev,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      updatedBy: parse(s.updatedBy, NOBODY),
      cells: (cellsBy.get(s.id) ?? []).map((c) => ({
        r: c.rowId,
        c: c.colId,
        ...(c.input ? { i: parse(c.input, undefined) } : {}),
        ...(c.format ? { f: parse(c.format, undefined) } : {}),
      })),
    }));
}

/** The drawing as SVG: the old tab (or one element of it) as it last drew. */
export function pictureSvg(
  input: OldDocumentInput,
  picture: { tabId: string; elementId: string | null },
  upgradeTab: (body: Record<string, unknown>) => Record<string, unknown>,
): string | null {
  const raw = input.tabs.find((t) => t.id === picture.tabId);
  if (!raw) return null;
  const body = parse<Record<string, unknown> | null>(raw.data, null);
  if (!body || typeof body !== 'object') return null;
  const upgraded = upgradeTab(body);
  const elementsIn: unknown[] = Array.isArray(upgraded.elements)
    ? (upgraded.elements as unknown[])
    : [];
  const tab = migrateStoredTab({
    ...upgraded,
    id: raw.id,
    name: raw.name,
    elements: elementsIn,
  } as unknown as Tab);
  const elements = picture.elementId
    ? tab.elements.filter((el) => el.id === picture.elementId)
    : tab.elements;
  if (elements.length === 0) return null;
  const drawn: Tab = { ...tab, elements };
  const plan = input.plan;
  const items = plan ? itemsOf(plan) : new Map<string, Item>();
  const types = typesOf(plan ? readItemTypeCatalogue(parse(plan.itemTypes, null)) : null);
  const frames = sheetFramesOf(elements);
  const sheets =
    plan && frames.length
      ? renderModelsForTab(
          sheetsOf(plan, new Set(frames.map((f) => f.sheetId))) as SheetJson[],
          frames,
          {
            cards: cardSourceOf(items.values(), types),
          },
        )
      : undefined;
  return renderElementsToSvg(drawn, {
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
    items,
    itemTypes: types,
    ...(sheets ? { sheets } : {}),
  });
}

/** The drawer the plan uses: liveplanner's renderer, then resvg with the Inter fonts, read from the installed
 *  packages only when the first picture is drawn. */
export function createPictureDrawer(): PictureDrawer {
  const renderer = createPngRenderer({
    wasm: () => readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')),
    font: () => readFile(require.resolve('@liveworkspace/render-png/fonts/Inter-Regular.ttf')),
    bold: () => readFile(require.resolve('@liveworkspace/render-png/fonts/Inter-Bold.otf')),
  });
  return async (input, picture, upgradeTab) => {
    const svg = pictureSvg(input, picture, upgradeTab);
    if (!svg) return null;
    const { png, width, height } = await renderer.renderPng(svg, 1, MAX_SIDE);
    return { png, width, height };
  };
}
