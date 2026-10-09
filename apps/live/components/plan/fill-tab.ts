// Fill Tab (docs/specs/026-plan/plan-board.md "Fill Tab"): which board fills a tab, what turning it on deletes, and
// the words that say so. Pure.
import type { Element } from '@livediagram/document';
import { normaliseBoardSetup, type PlanBoardSetup } from '@livediagram/items';

const isBoard = (el: Element) => el.type === 'shape' && el.shape === 'plan-board';

const isSheet = (el: Element) => el.type === 'shape' && el.shape === 'plan-sheet';

export type FillTabKind = 'Board' | 'Sheet';

// The element filling the tab: the first (in canvas order) board whose set-up has Fill Tab on, or Sheet whose
// `planSheet` has, or null. Reads the stored flag exactly (true), without normalising every board.
export function fillTabElementOf(
  elements: readonly Element[],
): { id: string; kind: FillTabKind } | null {
  for (const el of elements) {
    if (isBoard(el)) {
      const setup = (el as { planBoard?: unknown }).planBoard;
      if (setup && typeof setup === 'object' && (setup as { fillTab?: unknown }).fillTab === true)
        return { id: el.id, kind: 'Board' };
    } else if (isSheet(el)) {
      if ((el as { planSheet?: { fillTab?: unknown } }).planSheet?.fillTab === true)
        return { id: el.id, kind: 'Sheet' };
    }
  }
  return null;
}

// The tab once the Sheet `id` fills it: the Sheet alone, Fill Tab on. The same array when it is not on the tab.
export function fillTabSheetElements(elements: Element[], id: string): Element[] {
  const sheet = elements.find((el) => el.id === id && isSheet(el)) as
    (Element & { planSheet?: { sheetId: string } }) | undefined;
  if (!sheet?.planSheet) return elements;
  return [{ ...sheet, planSheet: { ...sheet.planSheet, fillTab: true } } as Element];
}

// The Sheet `id` back on the canvas (Fill Tab off).
export function unfillSheetElements(elements: Element[], id: string): Element[] {
  return elements.map((el) => {
    const ref = (el as { planSheet?: { sheetId: string; fillTab?: true } }).planSheet;
    if (el.id !== id || !isSheet(el) || !ref?.fillTab) return el;
    const { fillTab: _drop, ...rest } = ref;
    return { ...el, planSheet: rest } as Element;
  });
}

// What turning Fill Tab on for `boardId` deletes: every other element, and how many of them are locked.
export function fillTabOthers(
  elements: readonly Element[],
  boardId: string,
): { count: number; locked: number } {
  let count = 0;
  let locked = 0;
  for (const el of elements) {
    if (el.id === boardId) continue;
    count += 1;
    if ((el as { locked?: boolean }).locked) locked += 1;
  }
  return { count, locked };
}

// The tab once `boardId` fills it: the board alone, its set-up `update`d from the one it holds now (read at the
// commit, so an edit made while a confirm was open is kept) with Fill Tab on. The same array when the board is not on
// the tab, or its set-up cannot be read (nothing to fill).
export function fillTabElements(
  elements: Element[],
  boardId: string,
  update: (current: PlanBoardSetup) => PlanBoardSetup,
): Element[] {
  const board = elements.find((el) => el.id === boardId && isBoard(el));
  const current = board ? normaliseBoardSetup((board as { planBoard?: unknown }).planBoard) : null;
  if (!board || !current) return elements;
  return [{ ...board, planBoard: { ...update(current), fillTab: true } } as Element];
}

// The set-up with Fill Tab on or off (off is absent).
export function withFillTab(setup: PlanBoardSetup, on: boolean): PlanBoardSetup {
  const { fillTab: _drop, ...rest } = setup;
  return on ? { ...rest, fillTab: true } : rest;
}

const elementsNoun = (n: number) => (n === 1 ? '1 other element' : `${n} other elements`);

// The wizard's warning under its Fill Tab switch, or null on an otherwise empty tab.
export function fillTabWarning(count: number, saving: boolean): string | null {
  if (count <= 0) return null;
  return `The rest of this canvas becomes unusable, and its ${elementsNoun(count)} will be deleted when you ${
    saving ? 'save' : 'create'
  } the board.`;
}

// The confirm before Fill Tab deletes the rest of the canvas.
export function fillTabConfirm(
  title: string,
  others: { count: number; locked: number },
): { title: string; message: string; confirmLabel: string } {
  const locked = others.locked > 0 ? ` (${others.locked} of them locked)` : '';
  return {
    title: `Fill the Tab with ${title.trim() || 'This Board'}?`,
    message: `The rest of this canvas becomes unusable, and its ${elementsNoun(others.count)} will be deleted${locked}. Undo brings them back.`,
    confirmLabel: 'Delete and Fill Tab',
  };
}
