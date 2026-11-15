// An agent's sheet headers (docs/specs/030-forms/forms.md "The header row", Work Tracker 889): planned on the builder's
// sheetColumnPlan, so a form pointed at a template finds the template's header row, never writing a second on row 1.
import { describe, expect, it } from 'vitest';
import { sheetHeadersWrite, topRowTexts, type FormDefinition } from '@liveplanner/forms';
import { sheetFromJson, sheetFromTemplate, type Sheet } from '@liveplanner/sheets';
import { headerChanges } from './form-write';

let seed = 0;
const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

function contacts(): Sheet {
  const made = sheetFromTemplate({
    id: 'sheetT0001',
    tabId: 't',
    template: 'contacts',
    now: Date.UTC(2026, 9, 11),
    dark: false,
    rand,
  })!;
  return sheetFromJson({
    ...made.sheet,
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: { id: 'x', name: 'x', color: '#000000' },
  });
}

const form = (
  prompts: string[],
  columns?: Record<string, string>,
): Pick<FormDefinition, 'sections' | 'sheet'> => ({
  sections: [
    {
      id: 's',
      title: '',
      questions: prompts.map((prompt, i) => ({ id: `q-${i}`, type: 'short' as const, prompt })),
    },
  ],
  sheet: { tabId: 't', sheetId: 'sheetT0001', ...(columns ? { columns } : {}) },
});

const setsAt = (changes: ReturnType<typeof headerChanges>['changes']) =>
  changes.flatMap((c) => (c.op === 'set' ? [c.at] : []));

describe('an agent pointing a form at a sheet', () => {
  it("writes the Contacts template's missing headers on its header row (row 4), none on row 1", () => {
    const sheet = contacts();
    const { changes, added } = headerChanges(form(['Name', 'Email']), sheet);
    const at = setsAt(changes);
    expect(at.length).toBeGreaterThan(0);
    expect(at.every((a) => a.endsWith('4'))).toBe(true);
    expect(at.some((a) => /^[A-Z]+1$/.test(a))).toBe(false);
    // Name and Email are the template's own: only # and Submitted are new.
    expect(added).toEqual(['#', 'Submitted']);
    expect(changes.some((c) => c.op === 'freeze')).toBe(false);
  });

  it("picks the builder's columns for the same form and sheet, remembered columns honoured", () => {
    const sheet = contacts();
    const f = form(['Name', 'Email']);
    const builder = sheetHeadersWrite({
      form: f,
      layout: sheet.layout,
      rowTexts: topRowTexts(sheet),
      namedOnly: true,
    });
    const letters = (col: string) => String.fromCharCode(65 + sheet.layout.cols.indexOf(col));
    const cells = (builder.write && 'cells' in builder.write ? builder.write.cells : null) ?? [];
    const builderAt = cells.map((c) => `${letters(c.c)}4`);
    expect(setsAt(headerChanges(f, sheet).changes)).toEqual(builderAt);
    // A remembered column wins over a header of the same name.
    const remembered = form(['Name'], { 'q-0': sheet.layout.cols[3]! });
    const { added } = headerChanges(remembered, sheet);
    expect(added).not.toContain('Name');
  });

  it('gives a new sheet its headers on row 1, frozen, and a blank question no column', () => {
    const { changes, added } = headerChanges(form(['Name', '']), null);
    expect(added).toEqual(['#', 'Submitted', 'Name']);
    expect(setsAt(changes)).toEqual(['A1', 'B1', 'C1']);
    expect(changes).toContainEqual({ op: 'freeze', rows: 1 });
    expect(changes).toContainEqual({ op: 'format', range: 'A1:C1', format: { bold: true } });
  });

  it('writes nothing when every header is there', () => {
    const sheet = contacts();
    const once = headerChanges(form(['Name']), sheet);
    expect(once.added.length).toBeGreaterThan(0);
    // An empty plan: a form whose headers the sheet already holds (by remembered column).
    const cols = sheet.layout.cols;
    const all = form([], { '#': cols[0]!, at: cols[1]! });
    expect(headerChanges(all, sheet).changes).toEqual([]);
  });
});
