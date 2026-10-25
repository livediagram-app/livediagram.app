import { describe, expect, it } from 'vitest';
import { liftBestMatch } from './best-match';

// docs/specs/007-editor/start-diagramming.md (start-panel.md in liveplanner) "A title match leads".
const card = (id: string, name: string) => ({ id, name });
const groups = [
  {
    category: 'design',
    cards: [card('blueprint', 'Service Blueprint'), card('flow-x', 'Flowchart Swimlanes')],
  },
  { category: 'flows', cards: [card('flowchart', 'Flowchart'), card('data-flow', 'Data Flow')] },
];

describe('liftBestMatch', () => {
  it('lifts names that begin with the query, the exact one first, out of their groups', () => {
    const { best, groups: rest } = liftBestMatch(groups, 'flowchart');
    expect(best.map((c) => c.id)).toEqual(['flowchart', 'flow-x']);
    expect(rest.map((g) => g.cards.map((c) => c.id))).toEqual([['blueprint'], ['data-flow']]);
  });

  it('ignores case, punctuation and spaces as the search does', () => {
    expect(liftBestMatch([{ cards: [card('todo', 'To-Do List')] }], 'todo').best).toHaveLength(1);
    expect(liftBestMatch([{ cards: [card('todo', 'To-Do List')] }], 'TO DO').best).toHaveLength(1);
  });

  it('drops a group it empties, and leaves the results alone with no title match', () => {
    expect(liftBestMatch([{ cards: [card('a', 'Flowchart')] }], 'flowchart').groups).toEqual([]);
    expect(liftBestMatch(groups, 'blueprint')).toEqual({ best: [], groups });
    expect(liftBestMatch(groups, '  ')).toEqual({ best: [], groups });
  });

  it('lists a card in two groups once', () => {
    const twice = [{ cards: [card('a', 'Flowchart')] }, { cards: [card('a', 'Flowchart')] }];
    expect(liftBestMatch(twice, 'flow').best).toHaveLength(1);
  });
});
