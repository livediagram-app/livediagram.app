import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { presetSetup } from '@livediagram/items';
import {
  fillTabBoardIdOf,
  fillTabConfirm,
  fillTabElements,
  fillTabOthers,
  fillTabWarning,
  withFillTab,
} from './fill-tab';

// docs/specs/026-plan/plan-board.md "Fill Tab".
const board = (id: string, fillTab?: unknown): Element =>
  ({
    ...createShape('plan-board', 0, 0),
    id,
    planBoard: { ...presetSetup('kanban'), ...(fillTab === undefined ? {} : { fillTab }) },
  }) as Element;
const note = (id: string, locked = false): Element =>
  ({ ...createShape('square', 0, 0), id, ...(locked ? { locked: true } : {}) }) as Element;

describe('fillTabBoardIdOf', () => {
  it('is the first board in canvas order with Fill Tab exactly on', () => {
    expect(fillTabBoardIdOf([note('n'), board('a'), board('b', 'yes')])).toBeNull();
    expect(fillTabBoardIdOf([note('n'), board('a', true), board('b', true)])).toBe('a');
    expect(fillTabBoardIdOf([board('a'), board('b', true)])).toBe('b');
    expect(fillTabBoardIdOf([])).toBeNull();
  });
});

describe('turning Fill Tab on', () => {
  const els = [note('n1'), board('a'), note('n2', true), board('b')];

  it('counts every other element, locked ones too', () => {
    expect(fillTabOthers(els, 'a')).toEqual({ count: 3, locked: 1 });
    expect(fillTabOthers([board('a')], 'a')).toEqual({ count: 0, locked: 0 });
  });

  it('leaves the board alone, with Fill Tab on', () => {
    const out = fillTabElements(els, 'a', () => presetSetup('sprint'));
    expect(out.map((e) => e.id)).toEqual(['a']);
    expect(
      (out[0] as { planBoard?: { fillTab?: boolean; title?: string } }).planBoard,
    ).toMatchObject({ fillTab: true, title: presetSetup('sprint').title });
    // A board not on the tab: nothing changes.
    expect(fillTabElements(els, 'gone', () => presetSetup('sprint'))).toBe(els);
    expect(fillTabElements(els, 'n1', () => presetSetup('sprint'))).toBe(els);
  });

  // The set-up is read at the commit: an edit made while the confirm was open is kept.
  it('updates the board as it is when the change is made', () => {
    const edited = els.map((e) =>
      e.id === 'a'
        ? ({ ...e, planBoard: { ...presetSetup('kanban'), title: 'Renamed meanwhile' } } as Element)
        : e,
    );
    const out = fillTabElements(edited, 'a', (current) => ({ ...current }));
    expect(
      (out[0] as { planBoard?: { title?: string; fillTab?: boolean } }).planBoard,
    ).toMatchObject({ title: 'Renamed meanwhile', fillTab: true });
  });

  it('turns the flag on and off, off being absent', () => {
    const kanban = presetSetup('kanban');
    expect(withFillTab(kanban, true).fillTab).toBe(true);
    expect(withFillTab({ ...kanban, fillTab: true }, false)).not.toHaveProperty('fillTab');
  });
});

describe('Fill Tab’s words', () => {
  it('warns in the wizard only when something would be deleted', () => {
    expect(fillTabWarning(0, false)).toBeNull();
    expect(fillTabWarning(1, false)).toBe(
      'The rest of this canvas becomes unusable, and its 1 other element will be deleted when you create the board.',
    );
    expect(fillTabWarning(4, true)).toBe(
      'The rest of this canvas becomes unusable, and its 4 other elements will be deleted when you save the board.',
    );
  });

  it('confirms with the count, and the locked ones when any', () => {
    expect(fillTabConfirm('Sprint', { count: 3, locked: 0 })).toEqual({
      title: 'Fill the Tab with Sprint?',
      message:
        'The rest of this canvas becomes unusable, and its 3 other elements will be deleted. Undo brings them back.',
      confirmLabel: 'Delete and Fill Tab',
    });
    expect(fillTabConfirm('  ', { count: 2, locked: 1 })).toMatchObject({
      title: 'Fill the Tab with This Board?',
      message:
        'The rest of this canvas becomes unusable, and its 2 other elements will be deleted (1 of them locked). Undo brings them back.',
    });
  });
});
