// Fill Tab (docs/specs/026-plan/plan-board.md "Fill Tab"): which board fills a tab, what turning it on deletes, and
// the words that say so. Pure.
import type { Element } from '@livediagram/document';
import { normaliseBoardSetup, type PlanBoardSetup } from '@livediagram/items';

const isBoard = (el: Element) => el.type === 'shape' && el.shape === 'plan-board';

// The board filling the tab: the first (in canvas order) whose set-up has Fill Tab on, or null. Reads the stored
// flag as normaliseBoardSetup does (exactly true), without normalising every board.
export function fillTabBoardIdOf(elements: readonly Element[]): string | null {
  for (const el of elements) {
    if (!isBoard(el)) continue;
    const setup = (el as { planBoard?: unknown }).planBoard;
    if (setup && typeof setup === 'object' && (setup as { fillTab?: unknown }).fillTab === true)
      return el.id;
  }
  return null;
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
