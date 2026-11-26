import { describe, expect, it } from 'vitest';
import type { CollabIndexRows, Element } from '@liveknowledge/document';
import { withNoteQuotes } from './note-row-labels';

const note = (id: string) => ({ id, type: 'article-note' }) as unknown as Element;
const box = (id: string) => ({ id, type: 'shape' }) as unknown as Element;
const thread = (elementId: string, elementLabel = 'Untitled') =>
  ({ elementId, elementLabel }) as CollabIndexRows['threads'][number];
const action = (elementId: string, elementLabel = 'Untitled') =>
  ({ elementId, elementLabel }) as CollabIndexRows['actions'][number];
const body = (runs: object[]) => ({
  articles: { 'art-1': { blocks: [{ id: 'b1', type: 'paragraph', runs }] } },
});

describe('an Inbox row of a note on words is titled by its words', () => {
  it('quotes the saved words on the note’s thread and action', () => {
    const rows = { threads: [thread('n1')], actions: [action('n1')] };
    const out = withNoteQuotes(
      rows,
      [note('n1')],
      body([{ text: 'Every release ' }, { text: 'smoke tests', note: 'n1' }]),
    );
    expect(out.threads[0]!.elementLabel).toBe('“smoke tests”');
    expect(out.actions[0]!.elementLabel).toBe('“smoke tests”');
  });

  it('cuts long words to a title', () => {
    const out = withNoteQuotes(
      { threads: [thread('n1')], actions: [] },
      [note('n1')],
      body([{ text: 'word '.repeat(40), note: 'n1' }]),
    );
    const label = out.threads[0]!.elementLabel;
    expect(label.length).toBeLessThanOrEqual(82);
    expect(label.endsWith('…”')).toBe(true);
  });

  it('leaves a detached note, a labelled element and a page with no notes as they are', () => {
    const rows = { threads: [thread('n1'), thread('b1', 'Card')], actions: [] };
    const detached = withNoteQuotes(rows, [note('n1'), box('b1')], body([{ text: 'gone' }]));
    expect(detached.threads.map((t) => t.elementLabel)).toEqual(['Untitled', 'Card']);
    const plain = { threads: [thread('b1', 'Card')], actions: [] };
    expect(withNoteQuotes(plain, [box('b1')], undefined)).toBe(plain);
  });
});
