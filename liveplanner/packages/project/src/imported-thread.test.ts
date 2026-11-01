import { describe, expect, it } from 'vitest';
import type { TrackerCreate } from '@liveplanner/items';
import { isCardThread, readRestoredThread } from './card-threads';
import {
  IMPORT_WRITE_BYTES,
  importBatches,
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

describe('importBatches', () => {
  it('splits at the bulk cap and at the write size, never leaving a write empty', () => {
    const small = Array.from({ length: 450 }, (_, i) => ({ i }));
    expect(importBatches(small).map((b) => b.length)).toEqual([200, 200, 50]);
    expect(importBatches([])).toEqual([]);
    const big = Array.from({ length: 5 }, () => ({ text: 'x'.repeat(2 * 1024 * 1024) }));
    expect(importBatches(big).map((b) => b.length)).toEqual([2, 2, 1]);
    // Room the first write spends elsewhere moves its cards on.
    expect(importBatches(big, 4 * 1024 * 1024).map((b) => b.length)).toEqual([0, 2, 2, 1]);
    expect(importBatches(big, IMPORT_WRITE_BYTES - 3 * 1024 * 1024).map((b) => b.length)).toEqual([
      1, 2, 2,
    ]);
  });
});
