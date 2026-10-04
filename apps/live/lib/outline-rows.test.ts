import { describe, expect, it } from 'vitest';
import {
  indentRow,
  joinDown,
  joinUp,
  moveRow,
  outdentRow,
  pasteRows,
  rowsFromText,
  rowText,
  splitRow,
  textFromRows,
  type OutlineRow,
} from './outline-rows';

// The Edit Outline row editor's model (docs/specs/009-elements/mind-node.md "Edit Outline").

// Rows written compactly as "level:text", one per row.
const shape = (rows: OutlineRow[]) => rows.map((r) => `${r.level}:${rowText(r)}`);
const rows = (...spec: string[]): OutlineRow[] =>
  spec.map((s, i) => {
    const [level, text] = s.split(':');
    return { id: `r${i}`, level: Number(level), marks: text ? [{ text }] : [] };
  });

describe('rows and text', () => {
  it('reads an outline into rows and writes it back, formatting and further lines kept', () => {
    const text = 'Root\n- **Bold** idea\n  - Two\n    lines\n- Last';
    const read = rowsFromText(text);
    expect(shape(read)).toEqual(['0:Root', '1:Bold idea', '2:Two\nlines', '1:Last']);
    expect(read[1]!.marks[0]).toEqual({ text: 'Bold', bold: true });
    expect(textFromRows(read)).toBe(text);
  });

  it('starts from an empty root with no lines', () => {
    expect(shape(rowsFromText(''))).toEqual(['0:']);
  });
});

describe('splitRow (Enter)', () => {
  it('starts a sibling carrying the text after the caret', () => {
    const out = splitRow(rows('0:Root', '1:AB'), 1, 1);
    expect(shape(out.rows)).toEqual(['0:Root', '1:A', '1:B']);
    expect(out.caret).toEqual({ id: out.rows[2]!.id, offset: 0 });
  });

  it('starts the first child from the root, or from the end of a row with children', () => {
    expect(shape(splitRow(rows('0:Root'), 0, 4).rows)).toEqual(['0:Root', '1:']);
    expect(shape(splitRow(rows('0:Root', '1:A', '2:A1'), 1, 1).rows)).toEqual([
      '0:Root',
      '1:A',
      '2:',
      '2:A1',
    ]);
  });

  it('drops a selection first, as typing over it would', () => {
    expect(shape(splitRow(rows('0:Root', '1:AxxB'), 1, 1, 3).rows)).toEqual([
      '0:Root',
      '1:A',
      '1:B',
    ]);
  });

  it('steps an empty row out a level instead', () => {
    expect(shape(splitRow(rows('0:Root', '1:A', '2:'), 2, 0).rows)).toEqual([
      '0:Root',
      '1:A',
      '1:',
    ]);
  });
});

describe('indentRow / outdentRow (Tab / Shift+Tab)', () => {
  it('moves a row and its branch a level in, at most one below the row above', () => {
    const before = rows('0:Root', '1:A', '1:B', '2:B1');
    expect(shape(indentRow(before, 2)!)).toEqual(['0:Root', '1:A', '2:B', '3:B1']);
    expect(indentRow(before, 1)).toBeNull();
    expect(indentRow(before, 0)).toBeNull();
  });

  it('moves a row and its branch a level out, never past the first level', () => {
    const before = rows('0:Root', '1:A', '2:B', '3:B1');
    expect(shape(outdentRow(before, 2)!)).toEqual(['0:Root', '1:A', '1:B', '2:B1']);
    expect(outdentRow(before, 1)).toBeNull();
  });
});

describe('joinUp / joinDown (Backspace / Delete)', () => {
  it('removes an empty row, its children moving under the row above', () => {
    const out = joinUp(rows('0:Root', '1:A', '1:', '2:C'), 2)!;
    expect(shape(out.rows)).toEqual(['0:Root', '1:A', '2:C']);
    expect(out.caret).toEqual({ id: 'r1', offset: 1 });
  });

  it('joins a row with text onto the end of the row above', () => {
    expect(shape(joinUp(rows('0:Root', '1:A', '1:B'), 2)!.rows)).toEqual(['0:Root', '1:AB']);
    expect(shape(joinDown(rows('0:Root', '1:A', '1:B'), 1)!.rows)).toEqual(['0:Root', '1:AB']);
  });

  it('never removes the root', () => {
    expect(joinUp(rows('0:Root'), 0)).toBeNull();
  });
});

describe('moveRow (Alt+↑ / Alt+↓)', () => {
  const before = rows('0:Root', '1:A', '2:A1', '1:B', '2:B1');

  it('moves a branch past its neighbouring branch', () => {
    expect(shape(moveRow(before, 3, true)!)).toEqual(['0:Root', '1:B', '2:B1', '1:A', '2:A1']);
    expect(shape(moveRow(before, 1, false)!)).toEqual(['0:Root', '1:B', '2:B1', '1:A', '2:A1']);
  });

  it('stays within its parent and never passes the root', () => {
    expect(moveRow(before, 1, true)).toBeNull();
    expect(moveRow(before, 2, false)).toBeNull();
    expect(moveRow(before, 0, false)).toBeNull();
  });
});

describe('pasteRows', () => {
  it('reads pasted lines as rows nested from the row pasted into', () => {
    const out = pasteRows(rows('0:Root', '1:A'), 1, '- X\n  - Y\n- Z')!;
    expect(shape(out.rows)).toEqual(['0:Root', '1:A', '1:X', '2:Y', '1:Z']);
  });

  it("takes an empty row's place, and pastes under the root as its children", () => {
    expect(shape(pasteRows(rows('0:Root', '1:'), 1, 'X\nY')!.rows)).toEqual([
      '0:Root',
      '1:X',
      '1:Y',
    ]);
    expect(shape(pasteRows(rows('0:Root'), 0, 'X\nY')!.rows)).toEqual(['0:Root', '1:X', '1:Y']);
  });

  it('leaves a single line to ordinary typing', () => {
    expect(pasteRows(rows('0:Root'), 0, 'just text')).toBeNull();
  });
});
