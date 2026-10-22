// Sheets riding the clipboard (docs/specs/029-sheets/sheet.md "Copying a Sheet element"): a copied Sheet element
// carries its sheet's cells on the clipboard, so a paste into another document, which cannot copy a sheet it does
// not have, still makes the copy. The sheet chunk registers what it can read; a paste stashes what arrived; the
// pasted Sheet takes its seed when it first draws. Main bundle, and tiny: from the engine, types and the template
// catalogue's ids and names only.
import { isDefaultTabName, newPlanSheetId } from '@livedesign/document';
import {
  SHEET_TEMPLATE_IDS,
  SHEET_TEMPLATES,
  type SheetJson,
  type SheetTemplateId,
} from '@livedesign/sheets';

// The clipboard's limit for one sheet (the sheet store's write limit): a larger one pastes only within its
// document, where the copy is made on the server.
export const CLIPBOARD_SHEET_CELLS_MAX = 5_000;

let source: ((sheetId: string) => SheetJson | undefined) | null = null;
const seeds = new Map<string, SheetJson>();

export function registerSheetSource(
  read: ((sheetId: string) => SheetJson | undefined) | null,
): void {
  source = read;
}

// The sheets of copied Sheet elements, for the clipboard; one past the limit is left off.
export function sheetsForClipboard(sheetIds: readonly string[]): SheetJson[] {
  if (!source || sheetIds.length === 0) return [];
  const out: SheetJson[] = [];
  for (const id of new Set(sheetIds)) {
    const sheet = source(id);
    if (sheet && sheet.cells.length <= CLIPBOARD_SHEET_CELLS_MAX) out.push(sheet);
  }
  return out;
}

// Sheets placed but not yet made: the palette (or a dropped CSV file) names the sheet as the element lands, and the
// Sheet makes it in the store when it first draws (the sheet chunk may still be loading as it lands).
export type PlacedSheet = {
  // A dropped file's name, without its extension (made unique on the tab when the sheet is made).
  title?: string;
  // A dropped file's text, read into the new sheet as Import CSV would.
  csv?: string;
  // Start Planning's sheet types (docs/specs/026-plan/plan-mode.md): Setup Sheet opens on this start, a step in.
  start?: PlacedSheetStart;
  // The Plan tour's example sheet (docs/specs/026-plan/plan-tour.md "Tour content"): made already set up from this
  // start, in the Header look with its header frozen, never awaiting setup and never an undo step.
  setUp?: SheetTemplateId;
  // Start Planning's Empty Sheet: a blank grid ready to type into, never awaiting setup.
  blank?: true;
};

// The choice Start Planning's Empty Sheet places a Sheet with.
export const BLANK_SHEET_CHOICE = 'blank';

// The starts Start Planning offers beyond the empty sheet (SheetSetupStart's ids): a card table, or a template.
export const PLACED_SHEET_STARTS = ['cards', ...SHEET_TEMPLATE_IDS] as const;
export type PlacedSheetStart = (typeof PLACED_SHEET_STARTS)[number];
export const isPlacedSheetStart = (v: unknown): v is PlacedSheetStart =>
  (PLACED_SHEET_STARTS as readonly unknown[]).includes(v);

// The start a placed sheet's Setup Sheet opens on, by sheet id: read as it first draws (a render may read it twice),
// then forgotten once it has, so a sheet cleared later starts from the beginning.
const setupStarts = new Map<string, PlacedSheetStart>();
export function rememberSetupStart(sheetId: string, start: PlacedSheetStart): void {
  setupStarts.set(sheetId, start);
}
export function setupStartOf(sheetId: string): PlacedSheetStart | undefined {
  return setupStarts.get(sheetId);
}
export function forgetSetupStart(sheetId: string): void {
  setupStarts.delete(sheetId);
}

const placed = new Map<string, PlacedSheet>();

// What a Sheet placed on a tab still on its default name is called (that name names nothing): its start's name, as
// Start Planning shows it, or "Sheet" (docs/specs/026-plan/plan-tabs.md "Names").
export function sheetTitleForTab(tabName: string, start?: unknown): string {
  const name = tabName.trim();
  if (name && !isDefaultTabName(name)) return name;
  if (start === 'cards') return 'Card Table';
  return SHEET_TEMPLATES.find((t) => t.id === start)?.name ?? 'Sheet';
}

// The title `sheetId` was placed with, while it waits to be made (a new Sheet tab takes it).
export function placedSheetTitle(sheetId: string): string | undefined {
  return placed.get(sheetId)?.title;
}

export function placeNewSheet(from: PlacedSheet = {}): { sheetId: string } {
  const sheetId = newPlanSheetId();
  placed.set(sheetId, from);
  return { sheetId };
}

// What `sheetId` was placed with, when it was placed here and is waiting to be made; taking it clears the mark.
export function takePlacedSheet(sheetId: string): PlacedSheet | null {
  const from = placed.get(sheetId);
  placed.delete(sheetId);
  return from ?? null;
}

export function stashSheetSeeds(sheets: readonly SheetJson[]): void {
  for (const s of sheets) seeds.set(s.id, s);
}

// The seed for a copy of `sheetId`, if a paste brought one.
export function sheetSeed(sheetId: string): SheetJson | undefined {
  return seeds.get(sheetId);
}
