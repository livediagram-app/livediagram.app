import { describe, expect, it } from 'vitest';
import type { TrackerCreate } from '@liveplanner/items';
import { CARD_THREADS_MAX, isCardThread, readRestoredThread, threadsOnCard } from './card-threads';
import {
  IMPORTED_THREAD_COLOR,
  IMPORTED_THREAD_TITLE,
  importedCommentsThread,
  withImportedThreads,
} from './imported-thread';

// docs/specs/026-plan/tracker-import.md "Comments".

const NOW = Date.UTC(2026, 10, 1);
const comments = [
  { text: 'Ana Lopez · 12 Mar 2025\nLooking into it.', at: Date.UTC(2025, 2, 12) },
  { text: 'Unknown\nUndated note', at: null },
];

describe('importedCommentsThread', () => {
  it('makes one thread of the comments, from the import, with no author id or mentions', () => {
    const t = importedCommentsThread({
      projectId: 'p1',
      itemId: 'card1',
      sourceName: 'Jira',
      comments,
      now: NOW,
      random: () => 0,
    })!;
    expect(isCardThread(t)).toBe(true);
    expect(t).toMatchObject({
      id: 'th-aaaaaaaaaaaaaaaa',
      title: IMPORTED_THREAD_TITLE,
      resolved: false,
      home: 'p1',
      cards: [{ projectId: 'p1', itemId: 'card1', key: null }],
      createdBy: { name: 'Jira import', color: IMPORTED_THREAD_COLOR },
    });
    expect(t.comments).toEqual([
      {
        id: 'aaaaaaaaaaaaaaaa-0',
        text: comments[0]!.text,
        createdAt: Date.UTC(2025, 2, 12),
        authorName: 'Jira import',
        authorColor: IMPORTED_THREAD_COLOR,
      },
      {
        id: 'aaaaaaaaaaaaaaaa-1',
        text: comments[1]!.text,
        createdAt: NOW,
        authorName: 'Jira import',
        authorColor: IMPORTED_THREAD_COLOR,
      },
    ]);
    // A restore reads it back as it is.
    expect(readRestoredThread(t, 'someone')).toEqual(t);
  });

  it('makes no thread for a card with no comments', () => {
    expect(
      importedCommentsThread({
        projectId: 'p',
        itemId: 'c',
        sourceName: 'Trello',
        comments: [],
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe('withImportedThreads', () => {
  it('turns each card’s imported comments into its thread, dropping the comment list', () => {
    const creates: TrackerCreate[] = [
      {
        id: 'a1',
        type: 'jira-issue',
        fields: { title: 'A' },
        place: { status: 's' },
        importedComments: comments,
      },
      {
        id: 'b2',
        type: 'jira-issue',
        fields: { title: 'B' },
        place: { status: 's' },
        importedComments: [],
      },
    ];
    const out = withImportedThreads(creates, { projectId: 'p1', sourceName: 'Jira', now: NOW });
    expect(out[0]).not.toHaveProperty('importedComments');
    expect(out[0]!.threads).toHaveLength(1);
    expect(out[0]!.threads![0]!.cards[0]!.itemId).toBe('a1');
    expect(out[1]).toEqual({
      id: 'b2',
      type: 'jira-issue',
      fields: { title: 'B' },
      place: { status: 's' },
    });
    const seeded = withImportedThreads(creates, {
      projectId: 'p1',
      sourceName: 'Jira',
      now: NOW,
      random: () => 0.5,
    });
    expect(seeded[0]!.threads![0]!.id).toBe(`th-${'s'.repeat(16)}`);
  });
});

// docs/specs/026-plan/tracker-import.md "Comments": no exemption and no cap of its own.
describe('an Imported comments thread and the thread caps', () => {
  it('counts as an ordinary thread: one per card, toward its CARD_THREADS_MAX', () => {
    const creates: TrackerCreate[] = Array.from({ length: 300 }, (_, i) => ({
      id: `c${i}`,
      type: 'jira-issue',
      fields: { title: `Card ${i}` },
      place: { status: 's' },
      importedComments: comments,
    }));
    const out = withImportedThreads(creates, { projectId: 'p1', sourceName: 'Jira', now: NOW });
    const threads = out.flatMap((c) => c.threads ?? []);
    // One thread a card, however big the import: the plan's threads grow with its cards, as they always do.
    expect(threads).toHaveLength(creates.length);
    for (const c of out) {
      const on = threadsOnCard(threads, 'p1', c.id);
      expect(on).toHaveLength(1);
      // Read back as any thread is, nothing marking it apart, so every cap check counts it.
      expect(readRestoredThread(on[0], 'someone')).toEqual(on[0]);
      expect(CARD_THREADS_MAX - on.length).toBe(49);
    }
    // No author id and no mentions: nothing for an Inbox to list.
    for (const t of threads)
      for (const m of t.comments) {
        expect(m).not.toHaveProperty('authorId');
        expect(m).not.toHaveProperty('mentions');
      }
  });
});
