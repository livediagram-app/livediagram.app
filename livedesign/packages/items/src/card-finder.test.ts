import { describe, expect, it } from 'vitest';
import { cardMatches, findCards, isOffBoard, type BoardStatusTypes } from './card-finder';
import { item } from './test-items';

// docs/specs/026-plan/items.md "Finding a card".
describe('card finder', () => {
  const onBoard = {
    ...item({ title: 'Checkout flow', status: 'todo', description: 'Fewer fields' }),
    updatedAt: 1,
  };
  const orphan = { ...item({ title: 'Lost card', status: 'old~x1' }), updatedAt: 3 };
  const noStatus = { ...item({ title: 'Loose' }), updatedAt: 2 };
  const archived = item({ title: 'Archived', status: 'todo', archived: true });
  const trashed = item({ title: 'Binned', status: 'trash' });
  const all = [onBoard, orphan, noStatus, archived, trashed];
  const boardStatuses: BoardStatusTypes = new Map([
    ['todo', 'all'],
    ['done', 'all'],
  ]);

  it('lists live cards, newest change first', () => {
    expect(
      findCards(all, { query: '', show: 'all', boardStatuses }).map((i) => i.fields['title']),
    ).toEqual(['Lost card', 'Loose', 'Checkout flow']);
  });

  it('narrows to cards no column holds', () => {
    expect(isOffBoard(onBoard, boardStatuses)).toBe(false);
    expect(isOffBoard(noStatus, boardStatuses)).toBe(true);
    expect(findCards(all, { query: '', show: 'off-board', boardStatuses })).toHaveLength(2);
  });

  it('counts a card as off the board when every board naming its status hides its type', () => {
    const task = item({ title: 'Task', status: 'todo' }, { type: 'task' });
    const bug = item({ title: 'Bug', status: 'todo' }, { type: 'bug' });
    // Only boards that show Bugs name "todo": a Task there is shown by no board.
    const bugsOnly: BoardStatusTypes = new Map([['todo', new Set(['bug'])]]);
    expect(isOffBoard(bug, bugsOnly)).toBe(false);
    expect(isOffBoard(task, bugsOnly)).toBe(true);
    expect(
      findCards([task, bug], { query: '', show: 'off-board', boardStatuses: bugsOnly }).map(
        (i) => i.fields['title'],
      ),
    ).toEqual(['Task']);
    // A board that shows every type and names the status puts both on a board.
    const everyType: BoardStatusTypes = new Map([['todo', 'all']]);
    expect(isOffBoard(task, everyType)).toBe(false);
    // A board whose Card Types are empty shows nothing.
    const noTypes: BoardStatusTypes = new Map([['todo', new Set<string>()]]);
    expect(isOffBoard(bug, noTypes)).toBe(true);
  });

  it('matches on number, title and description', () => {
    expect(cardMatches(onBoard, `#${onBoard.key}`)).toBe(true);
    expect(cardMatches(onBoard, 'CHECKOUT')).toBe(true);
    expect(cardMatches(onBoard, 'fewer')).toBe(true);
    expect(cardMatches(onBoard, 'nothing like it')).toBe(false);
    expect(cardMatches(noStatus, '   ')).toBe(true);
  });

  it('searches a full store of long descriptions within a keystroke budget', () => {
    const many = Array.from({ length: 2000 }, (_, n) =>
      item({ title: `Card ${n}`, status: 'todo', description: 'x'.repeat(10_000) }),
    );
    findCards(many, { query: 'warm', show: 'all', boardStatuses });
    const start = performance.now();
    for (const q of ['c', 'ca', 'car', 'card', 'card 1', 'card 19']) {
      findCards(many, { query: q, show: 'all', boardStatuses });
    }
    // Six keystrokes over the cached text (17ms locally); the budget leaves room for a slow CI runner.
    expect(performance.now() - start).toBeLessThan(600);
  });

  it('lists cards of custom types, finds them by type name, and narrows to chosen types', () => {
    const person = { ...item({ title: 'Sam Reed' }, { type: 'person' }), updatedAt: 5 };
    const goal = { ...item({ title: 'Grow revenue' }, { type: 'objective' }), updatedAt: 4 };
    const mixed = [onBoard, person, goal];
    const labels: Record<string, string> = {
      person: 'Person',
      objective: 'Objective',
      task: 'Task',
    };
    const typeLabel = (id: string) => labels[id] ?? 'Item';
    const titles = (types?: Set<string>, query = '') =>
      findCards(mixed, {
        query,
        show: 'all',
        boardStatuses,
        typeLabel,
        ...(types ? { types } : {}),
      }).map((i) => i.fields['title']);
    expect(titles()).toEqual(['Sam Reed', 'Grow revenue', 'Checkout flow']);
    expect(titles(undefined, 'person')).toEqual(['Sam Reed']);
    expect(titles(new Set(['objective']))).toEqual(['Grow revenue']);
    expect(titles(new Set(['person', 'task']))).toEqual(['Sam Reed', 'Checkout flow']);
    // An empty set is every type.
    expect(titles(new Set())).toHaveLength(3);
  });
});
