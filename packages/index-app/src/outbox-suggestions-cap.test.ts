// capCollabPush and a tab's suggested edits (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item
// pushes"): each cut as the index cuts it, the newest COLLAB_MAX_SUGGESTIONS kept in a fixed order, counted in the
// push's bytes with the threads and actions, and a push without them sending none.
import { describe, expect, it } from 'vitest';
import {
  COLLAB_MAX_SUGGESTIONS,
  COLLAB_SUGGESTION_AGENT_MAX,
  COLLAB_SUGGESTION_REASON_MAX,
  COLLAB_SUGGESTION_TEXT_MAX,
  type CollabPush,
  type CollabSuggestionInput,
  type CollabThreadInput,
} from '@liveworkspace/index-client';
import { capCollabPush } from './outbox';

const sentBytes = (push: CollabPush) => new TextEncoder().encode(JSON.stringify(push)).byteLength;

function suggestion(i: number, over: Partial<CollabSuggestionInput> = {}): CollabSuggestionInput {
  return {
    id: `s-${String(i).padStart(3, '0')}`,
    ownerId: null,
    agent: 'Claude',
    reason: 'The rota moved to Tuesdays.',
    kind: 'replace',
    before: 'On call runs on Mondays.',
    after: 'On call runs on Tuesdays.',
    createdAt: 1_000 + i,
    ...over,
  };
}

function thread(i: number): CollabThreadInput {
  return {
    elementId: `el-${i}`,
    elementLabel: 'Heading',
    resolved: false,
    commentCount: 1,
    participantIds: ['p1'],
    mentionedIds: [],
    latestText: 'x'.repeat(400),
    latestAuthorName: 'Ada',
    firstAt: 1,
    latestAt: 1_000 + i,
  };
}

describe('capCollabPush with suggested edits', () => {
  it('sends no suggestions field when the push had none', () => {
    const capped = capCollabPush({ threads: [thread(1)], actions: [] });
    expect('suggestions' in capped).toBe(false);
  });

  it('cuts each text as the index does', () => {
    const capped = capCollabPush({
      threads: [],
      actions: [],
      suggestions: [
        suggestion(1, {
          agent: 'A'.repeat(500),
          reason: 'r'.repeat(2_000),
          before: 'b'.repeat(9_000),
          after: 'a'.repeat(9_000),
        }),
      ],
    });
    const [s] = capped.suggestions!;
    expect(s!.agent).toHaveLength(COLLAB_SUGGESTION_AGENT_MAX);
    expect(s!.reason).toHaveLength(COLLAB_SUGGESTION_REASON_MAX);
    expect(s!.before).toHaveLength(COLLAB_SUGGESTION_TEXT_MAX);
    expect(s!.after).toHaveLength(COLLAB_SUGGESTION_TEXT_MAX);
  });

  it('keeps the newest 50, newest first then by id, whatever order they came in', () => {
    const all = Array.from({ length: 80 }, (_, i) =>
      suggestion(i, { createdAt: 1_000 + (i % 40) }),
    );
    const one = capCollabPush({ threads: [], actions: [], suggestions: all });
    const other = capCollabPush({ threads: [], actions: [], suggestions: [...all].reverse() });
    expect(one).toEqual(other);
    expect(one.suggestions).toHaveLength(COLLAB_MAX_SUGGESTIONS);
    const times = one.suggestions!.map((s) => s.createdAt);
    expect(times).toEqual([...times].sort((a, b) => b - a));
    // Two at the newest time: the lower id first.
    expect(one.suggestions![0]!.id < one.suggestions![1]!.id).toBe(true);
  });

  it('counts suggestions in the bytes, keeping every row newer than any it leaves out', () => {
    const threads = Array.from({ length: 100 }, (_, i) => thread(2 * i));
    const suggestions = Array.from({ length: COLLAB_MAX_SUGGESTIONS }, (_, i) =>
      suggestion(2 * i + 1, { before: 'b'.repeat(2_000), after: 'a'.repeat(2_000) }),
    );
    const capped = capCollabPush({ threads, actions: [], suggestions }, 60_000);
    expect(sentBytes(capped)).toBeLessThanOrEqual(60_000);
    expect(capped.suggestions!.length).toBeGreaterThan(0);
    expect(capped.suggestions!.length).toBeLessThan(suggestions.length);
    const kept = [
      ...capped.threads.map((t) => t.latestAt),
      ...capped.suggestions!.map((s) => s.createdAt),
    ];
    const keptSet = new Set(kept);
    const dropped = [
      ...threads.map((t) => t.latestAt),
      ...suggestions.map((s) => s.createdAt),
    ].filter((t) => !keptSet.has(t));
    expect(Math.min(...kept)).toBeGreaterThan(Math.max(...dropped));
  });

  it('keeps the worst case (50 suggestions of four-byte text) under the index limit', () => {
    const emoji = '🚀'.repeat(COLLAB_SUGGESTION_TEXT_MAX);
    const suggestions = Array.from({ length: COLLAB_MAX_SUGGESTIONS }, (_, i) =>
      suggestion(i, { before: emoji, after: emoji, reason: emoji }),
    );
    const capped = capCollabPush({ threads: [], actions: [], suggestions });
    expect(sentBytes(capped)).toBeLessThanOrEqual(512 * 1024);
  });
});
