import { describe, expect, it } from 'vitest';
import { ARCHIVED_FIELD, TRASH_STATUS, type Item } from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { cardPassages, isCardSource } from './ask-cards';

// docs/specs/026-plan/ask-ai.md: Ask AI reads the plan's cards as well as its tabs' elements.

let n = 0;
function card(fields: Record<string, unknown>): Item {
  n += 1;
  return {
    id: `i${n}`,
    type: 'task',
    key: n,
    rank: 'a',
    fields,
    createdAt: 0,
    updatedAt: 0,
  } as unknown as Item;
}
const mapOf = (...items: Item[]) => new Map(items.map((item) => [item.id, item]));
const board = { id: 'tab-board', name: 'Board' };
const first = { id: 'tab-1', name: 'Overview' };

describe("a plan's cards as Ask AI reads them", () => {
  it('makes a passage of each live card: number, title, description and status, on the tab that shows it', () => {
    const shown = card({
      title: ' Fix sign-in ',
      status: 'In Progress',
      description: ' Users bounce. ',
    });
    const bare = card({ status: 'todo' });
    const untitled = card({});
    const passages = cardPassages({
      items: mapOf(
        shown,
        bare,
        untitled,
        card({ title: 'Gone', status: TRASH_STATUS }),
        card({ title: 'Old', status: 'done', [ARCHIVED_FIELD]: true }),
      ),
      tabOf: (item) => (item === shown ? board : null),
      fallback: first,
    });
    expect(passages).toEqual([
      {
        id: `card:${shown.id}`,
        tabId: 'tab-board',
        tabName: 'Board',
        elementId: shown.id,
        kind: 'Card',
        title: `#${shown.key} Fix sign-in`,
        text: `#${shown.key} Fix sign-in\nUsers bounce.\nStatus: In Progress`,
      },
      {
        id: `card:${bare.id}`,
        tabId: 'tab-1',
        tabName: 'Overview',
        elementId: bare.id,
        kind: 'Card',
        title: `#${bare.key}`,
        text: `#${bare.key}\nStatus: todo`,
      },
      {
        id: `card:${untitled.id}`,
        tabId: 'tab-1',
        tabName: 'Overview',
        elementId: untitled.id,
        kind: 'Card',
        title: `#${untitled.key}`,
        text: `#${untitled.key}`,
      },
    ]);
    expect(isCardSource(passages[0]!)).toBe(true);
    expect(isCardSource({ id: 'tab-1:el-1' })).toBe(false);
  });

  it('has none with no cards, and leaves out a card with nowhere to open', () => {
    expect(cardPassages({ items: undefined, tabOf: () => null, fallback: first })).toEqual([]);
    expect(
      cardPassages({ items: mapOf(card({ title: 'A' })), tabOf: () => null, fallback: undefined }),
    ).toEqual([]);
  });

  it("reads a plan's worth of cards well inside a frame's budget", () => {
    const many = mapOf(
      ...Array.from({ length: 5000 }, (_x, at) =>
        card({
          title: `Card ${at}`,
          status: 'todo',
          description: 'Some words about it. '.repeat(10),
        }),
      ),
    );
    const ms = cpuMsOf(() => cardPassages({ items: many, tabOf: () => board, fallback: first }));
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});
