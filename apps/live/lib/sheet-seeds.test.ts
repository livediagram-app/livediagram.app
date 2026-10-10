// Sheets riding the clipboard and sheets placed but not yet made (docs/specs/029-sheets/sheet.md "Copying a Sheet
// element"): the source the sheet chunk registers, the clipboard's size limit, the placed mark taken once, and the
// seeds a paste stashes.
import { afterEach, describe, expect, it } from 'vitest';
import type { SheetJson } from '@livediagram/sheets';
import {
  forgetSetupStart,
  isPlacedSheetStart,
  rememberSetupStart,
  setupStartOf,
  CLIPBOARD_SHEET_CELLS_MAX,
  placeNewSheet,
  registerSheetSource,
  sheetSeed,
  sheetsForClipboard,
  stashSheetSeeds,
  takePlacedSheet,
} from './sheet-seeds';

const sheet = (id: string, cells = 0): SheetJson => ({
  id,
  tabId: 't1',
  title: id,
  layout: { rows: [], cols: [] },
  cells: Array.from({ length: cells }, (_, i) => ({ r: `r${i}`, c: 'c1', i: { n: i } })),
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: { id: 'me', name: 'Me', color: '#000000' },
});

afterEach(() => registerSheetSource(null));

describe('sheetsForClipboard', () => {
  it('is empty with no source registered, or no ids asked for', () => {
    expect(sheetsForClipboard(['sheetAAAA'])).toEqual([]);
    registerSheetSource((id) => sheet(id));
    expect(sheetsForClipboard([])).toEqual([]);
  });

  it('reads each named sheet once, leaving out unknown ones and ones past the limit', () => {
    const known: Record<string, SheetJson> = {
      small0001: sheet('small0001', 2),
      edge00001: sheet('edge00001', CLIPBOARD_SHEET_CELLS_MAX),
      large0001: sheet('large0001', CLIPBOARD_SHEET_CELLS_MAX + 1),
    };
    registerSheetSource((id) => known[id]);
    const out = sheetsForClipboard([
      'small0001',
      'small0001',
      'missing01',
      'edge00001',
      'large0001',
    ]);
    expect(out.map((s) => s.id)).toEqual(['small0001', 'edge00001']);
  });

  it('stops reading once the source is unregistered', () => {
    registerSheetSource((id) => sheet(id));
    registerSheetSource(null);
    expect(sheetsForClipboard(['sheetAAAA'])).toEqual([]);
  });
});

describe('placed sheets', () => {
  it('returns what a sheet was placed with, once', () => {
    const { sheetId } = placeNewSheet({ title: 'Budget', csv: 'a,b' });
    expect(sheetId).toEqual(expect.any(String));
    expect(takePlacedSheet(sheetId)).toEqual({ title: 'Budget', csv: 'a,b' });
    expect(takePlacedSheet(sheetId)).toBeNull();
  });

  it('places a plain sheet with nothing, and gives each a new id', () => {
    const a = placeNewSheet();
    const b = placeNewSheet();
    expect(a.sheetId).not.toBe(b.sheetId);
    expect(takePlacedSheet(a.sheetId)).toEqual({});
    expect(takePlacedSheet(b.sheetId)).toEqual({});
  });

  it('knows nothing of a sheet it did not place', () => {
    expect(takePlacedSheet('never0001')).toBeNull();
  });
});

describe('seeds', () => {
  it('keeps what a paste brought, by sheet id, the latest winning', () => {
    expect(sheetSeed('seed00001')).toBeUndefined();
    stashSheetSeeds([sheet('seed00001', 1), sheet('seed00002')]);
    expect(sheetSeed('seed00001')?.cells).toHaveLength(1);
    expect(sheetSeed('seed00002')?.id).toBe('seed00002');
    stashSheetSeeds([sheet('seed00001', 3)]);
    expect(sheetSeed('seed00001')?.cells).toHaveLength(3);
  });
});

describe('a sheet type placed from Start Planning', () => {
  it('carries its start to the new sheet, which its Setup Sheet reads until it forgets it', () => {
    expect(isPlacedSheetStart('budget')).toBe(true);
    expect(isPlacedSheetStart('timesheet')).toBe(false);
    expect(isPlacedSheetStart(undefined)).toBe(false);
    const { sheetId } = placeNewSheet({ start: 'cards' });
    expect(takePlacedSheet(sheetId)).toEqual({ start: 'cards' });
    rememberSetupStart(sheetId, 'cards');
    expect(setupStartOf(sheetId)).toBe('cards');
    expect(setupStartOf(sheetId)).toBe('cards');
    forgetSetupStart(sheetId);
    expect(setupStartOf(sheetId)).toBeUndefined();
  });
});
