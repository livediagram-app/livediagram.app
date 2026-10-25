import { describe, expect, it } from 'vitest';
import { presetSetup, projectBoard, type Item } from '@liveplanner/items';
import { coveredKeyRole } from '@/hooks/canvas/editor-shortcut-keys';
import { planBoardKey } from '@/components/plan/plan-board-keys';
import { sheetKey } from '@/components/sheets/sheet-keys';
import { SHORTCUT_SECTIONS, type ShortcutRow } from './shortcut-sections';

// The Keyboard settings list and the handlers are two hand-kept lists of one thing. The list is the reference the
// help centre tells people to trust, so a row for a key that does nothing on a Board, Sheet, Dashboard or Form tab is
// a documented lie, and a key that works with no row is a feature nobody can find. Neither shows up in a render, a
// typecheck or a lint.

const section = (heading: string) => SHORTCUT_SECTIONS.find((s) => s.heading === heading)!.rows;

// A row's keys as the KeyboardEvent the handlers see: ⌘ as metaKey, ⇧ / Shift as shiftKey, the rest the key.
const NAMED: Record<string, string> = {
  Del: 'Delete',
  Arrow: 'ArrowDown',
  '↓': 'ArrowDown',
};
function eventOf(row: ShortcutRow) {
  const mods = new Set(['⌘', '⇧', 'Shift', 'Alt']);
  const main = row.keys.filter((k) => !mods.has(k))[0]!;
  const key = NAMED[main] ?? main;
  return {
    key: /^[A-Z]$/.test(key) ? key.toLowerCase() : key,
    code: '',
    metaKey: row.keys.includes('⌘'),
    ctrlKey: false,
    shiftKey: row.keys.includes('⇧') || row.keys.includes('Shift'),
    altKey: row.keys.includes('Alt'),
  };
}

const ZOOM_ROWS = new Set(['+', '-', '0']);

describe('the Keyboard settings list matches the keys a Plan tab answers', () => {
  it('reads real rows (guard against this test going blind)', () => {
    expect(SHORTCUT_SECTIONS.map((s) => s.heading)).toEqual([
      'Everywhere',
      'On a Board',
      'In a Sheet',
    ]);
    expect(SHORTCUT_SECTIONS.flatMap((s) => s.rows).length).toBeGreaterThan(20);
  });

  it('lists only editor-wide keys that run on a Plan tab', () => {
    // On a Plan tab the canvas is covered, so the editor runs just what coveredKeyRole lets through. F6 is the
    // region cycle's own listener (@liveworkspace/workbench/hooks/ui/useRegionCycle.ts), not the editor's.
    const dead = section('Everywhere')
      .filter((row) => row.keys[0] !== 'F6')
      .filter((row) => coveredKeyRole(eventOf(row), false) !== 'run')
      .map((row) => row.label);
    expect(dead).toEqual([]);
  });

  it('leaves no editor-wide plain key that runs on a Plan tab undocumented', () => {
    const documented = new Set(
      section('Everywhere')
        .filter((row) => row.keys.length === 1)
        .map((row) => row.keys[0]!.toLowerCase()),
    );
    const plain = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    const running = plain.filter(
      (key) =>
        coveredKeyRole(
          { key, code: '', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
          false,
        ) === 'run',
    );
    expect(running.length).toBeGreaterThan(0);
    expect(running.filter((key) => !documented.has(key))).toEqual([]);
  });

  it("lists only keys a focused card answers on a Board (docs/specs/026-plan/plan-board.md 'Keyboard')", () => {
    let n = 0;
    const item = (status: string, rank: string): Item => {
      n += 1;
      const by = { id: 'p', name: 'P', color: '#000000' };
      return {
        ...{ id: `i${n}`, type: 'task', key: n, rank, rev: 1, createdAt: 0, updatedAt: 0 },
        fields: { title: `Card ${n}`, status },
        createdBy: by,
        updatedBy: by,
      };
    };
    const setup = {
      ...presetSetup('blank'),
      columns: [
        { id: 'todo', status: 'todo', name: 'To do' },
        { id: 'done', status: 'done', name: 'Done' },
      ],
      doneColumnId: 'done',
    };
    const a = item('todo', 'a');
    const b = item('todo', 'b');
    const board = projectBoard(setup, new Map([a, b].map((i) => [i.id, i])));
    const dead = section('On a Board')
      .filter((row) => {
        const e = eventOf(row);
        const key = row.keys.includes('Shift') && e.key === 'ArrowDown' ? 'ArrowRight' : e.key;
        return planBoardKey(board, a.id, key, e.shiftKey, true) === null;
      })
      .map((row) => row.label);
    expect(dead).toEqual([]);
  });

  it("lists only keys a Sheet's grid answers, and its zoom chords (docs/specs/029-sheets/sheet.md)", () => {
    const dead = section('In a Sheet')
      .filter((row) => {
        const e = eventOf(row);
        if (row.keys.includes('⌘') && ZOOM_ROWS.has(e.key))
          return coveredKeyRole(e, true) !== 'run';
        return sheetKey(e) === null;
      })
      .map((row) => row.label);
    expect(dead).toEqual([]);
  });

  it('names nothing from the diagram editor', () => {
    const labels = SHORTCUT_SECTIONS.flatMap((s) => s.rows.map((r) => r.label)).join('\n');
    expect(labels).not.toMatch(
      /shape|element|tool|frame|isometric|mind node|flowchart|palette|nudge|canvas/i,
    );
  });
});
