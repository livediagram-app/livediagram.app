// Sheets in the clipboard envelope (docs/specs/029-sheets/sheet.md "Copying a Sheet element"): a copied Sheet
// element carries its sheet's cells, so a paste into another document can still make the copy; a paste stashes
// what arrived for the pasted Sheet to take.
import { afterEach, describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import type { SheetJson } from '@livediagram/sheets';
import {
  CLIPBOARD_KIND,
  MAX_CLIPBOARD_BYTES,
  parseElementsPayload,
  serialiseElements,
  takeSheetSeeds,
} from './clipboard-payload';
import { registerSheetSource, sheetSeed } from './sheet-seeds';

const sheetJson = (id: string, text = ''): SheetJson => ({
  id,
  tabId: 't1',
  title: id,
  layout: { rows: ['r1'], cols: ['c1'] },
  cells: text ? [{ r: 'r1', c: 'c1', i: { s: text } }] : [],
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: { id: 'me', name: 'Me', color: '#000000' },
});

const sheetEl = (id: string, planSheet: { sheetId: string; copyOf?: string }): Element =>
  ({
    id,
    type: 'shape',
    shape: 'plan-sheet',
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    planSheet,
  }) as Element;

const rect = (id: string): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 }) as Element;

afterEach(() => registerSheetSource(null));

describe('serialiseElements with Sheets', () => {
  it('carries the sheet of each copied Sheet element, the original for one still a copy', () => {
    const asked: string[] = [];
    registerSheetSource((id) => {
      asked.push(id);
      return sheetJson(id, 'hello');
    });
    const text = serialiseElements([
      sheetEl('e1', { sheetId: 'sheetAAAA' }),
      sheetEl('e2', { sheetId: 'sheetBBBB', copyOf: 'sheetCCCC' }),
      rect('e3'),
    ]);
    expect(asked).toEqual(['sheetAAAA', 'sheetCCCC']);
    const env = JSON.parse(text) as { sheets: SheetJson[] };
    expect(env.sheets.map((s) => s.id)).toEqual(['sheetAAAA', 'sheetCCCC']);
  });

  it('leaves the sheets field off when no sheet travels', () => {
    expect(JSON.parse(serialiseElements([rect('e1')]))).not.toHaveProperty('sheets');
    // A Sheet element whose sheet the store does not have.
    registerSheetSource(() => undefined);
    expect(
      JSON.parse(serialiseElements([sheetEl('e1', { sheetId: 'sheetAAAA' })])),
    ).not.toHaveProperty('sheets');
  });

  it('drops the sheets, keeping the elements, when they would pass the clipboard size', () => {
    registerSheetSource((id) => sheetJson(id, 'x'.repeat(MAX_CLIPBOARD_BYTES)));
    const text = serialiseElements([sheetEl('e1', { sheetId: 'sheetAAAA' })]);
    const env = JSON.parse(text) as { sheets?: unknown; elements: Element[] };
    expect(env.sheets).toBeUndefined();
    expect(env.elements.map((e) => e.id)).toEqual(['e1']);
    expect(parseElementsPayload(text)?.map((e) => e.id)).toEqual(['e1']);
  });
});

describe('takeSheetSeeds', () => {
  it('stashes the sheets a payload of ours carried', () => {
    registerSheetSource((id) => sheetJson(id, 'seeded'));
    const text = serialiseElements([sheetEl('e1', { sheetId: 'seedAAAA1' })]);
    registerSheetSource(null);
    takeSheetSeeds(text);
    expect(sheetSeed('seedAAAA1')?.cells[0]?.i).toEqual({ s: 'seeded' });
  });

  it('ignores empty, foreign, broken and oversized text', () => {
    takeSheetSeeds(null);
    takeSheetSeeds(undefined);
    takeSheetSeeds('');
    takeSheetSeeds('plain text');
    takeSheetSeeds(JSON.stringify({ kind: 'other', sheets: [sheetJson('foreign01')] }));
    takeSheetSeeds(JSON.stringify({ kind: CLIPBOARD_KIND, sheets: 'nope' }));
    takeSheetSeeds('{"sheets": [broken');
    const big = JSON.stringify({ kind: CLIPBOARD_KIND, sheets: [sheetJson('big000001')] });
    takeSheetSeeds(big + ' '.repeat(MAX_CLIPBOARD_BYTES));
    expect(sheetSeed('foreign01')).toBeUndefined();
    expect(sheetSeed('big000001')).toBeUndefined();
  });
});
