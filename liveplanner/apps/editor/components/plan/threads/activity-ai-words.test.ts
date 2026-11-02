import { describe, expect, it } from 'vitest';
import type { ItemHistoryChange } from '@liveplanner/items';
import { aiRunWords } from './activity-ai-words';

// The AI sparkle's words in a card's Activity tab (docs/specs/026-plan/items.md "The AI sparkle's words").
const run = (...entries: ItemHistoryChange[][]) => entries.map((changes) => ({ changes }));

describe('aiRunWords', () => {
  it.each<[string, ItemHistoryChange[]]>([
    ['Transitioned by AI', [{ kind: 'moved', from: 'todo', to: 'doing' }]],
    ['Created by AI', [{ kind: 'created', status: 'todo' }]],
    ['Edited by AI', [{ kind: 'set', field: 'priority', value: 'high' }]],
    ['Edited by AI', [{ kind: 'cleared', field: 'due' }]],
    ['Edited by AI', [{ kind: 'type', from: 'task', to: 'bug' }]],
    ['Renamed by AI', [{ kind: 'set', field: 'title', value: 'New name' }]],
    ['Trashed by AI', [{ kind: 'trashed' }]],
    ['Archived by AI', [{ kind: 'archived' }]],
    ['Restored by AI', [{ kind: 'untrashed' }]],
    ['Restored by AI', [{ kind: 'unarchived' }]],
    ['Flagged by AI', [{ kind: 'flagged' }]],
    ['Unflagged by AI', [{ kind: 'unflagged' }]],
  ])('reads %s', (words, changes) => {
    expect(aiRunWords(run(changes))).toBe(words);
  });

  it('keeps one verb across a run of several entries of one kind', () => {
    expect(
      aiRunWords(
        run(
          [{ kind: 'moved', from: 'todo', to: 'doing' }],
          [{ kind: 'moved', from: 'doing', to: 'done' }],
        ),
      ),
    ).toBe('Transitioned by AI');
    expect(aiRunWords(run([{ kind: 'untrashed' }], [{ kind: 'unarchived' }]))).toBe(
      'Restored by AI',
    );
  });

  it('reads a rename beside other edits as an edit', () => {
    expect(
      aiRunWords(
        run([
          { kind: 'set', field: 'title', value: 'A' },
          { kind: 'set', field: 'priority', value: 'low' },
        ]),
      ),
    ).toBe('Edited by AI');
  });

  it('reads a mixed run, or one with nothing kept, as Changed by AI', () => {
    expect(
      aiRunWords(
        run(
          [{ kind: 'moved', from: 'todo', to: 'doing' }],
          [{ kind: 'set', field: 'priority', value: 'low' }],
        ),
      ),
    ).toBe('Changed by AI');
    expect(aiRunWords(run([{ kind: 'flagged' }, { kind: 'unflagged' }]))).toBe('Changed by AI');
    expect(aiRunWords([])).toBe('Changed by AI');
  });
});
