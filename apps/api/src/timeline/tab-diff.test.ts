import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/diagram';
import { completedActions, newActions, newComments, newlyResolvedThreads } from './tab-diff';

// The diff is the only place that can tell "a comment was added" or "a
// thread was resolved" (docs/specs/013-workspace/timeline.md §4.3): comments and actions live in
// element JSON, not in tables. These pin what a save is read as.

function shape(id: string, extra: Record<string, unknown> = {}): Element {
  return {
    id,
    type: 'shape',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...extra,
  } as unknown as Element;
}

function comment(id: string, text: string) {
  return { id, text, createdAt: 1, authorName: 'Priya', authorColor: '#000' };
}

describe('newlyResolvedThreads', () => {
  it('reports a thread that flipped to resolved, with its opening comment', () => {
    const prev = [
      shape('a', {
        commentThread: { comments: [comment('c1', 'Per-shard or global?')], resolved: false },
      }),
    ];
    const next = [
      shape('a', {
        commentThread: { comments: [comment('c1', 'Per-shard or global?')], resolved: true },
      }),
    ];
    expect(newlyResolvedThreads(next, prev)).toEqual([
      { elementId: 'a', text: 'Per-shard or global?' },
    ]);
  });

  it('ignores a thread that was already resolved, or that arrived resolved', () => {
    const resolved = shape('a', {
      commentThread: { comments: [comment('c1', 'x')], resolved: true },
    });
    expect(newlyResolvedThreads([resolved], [resolved])).toEqual([]);
    // No thread before at all: nobody watched this get resolved.
    expect(newlyResolvedThreads([resolved], [shape('a')])).toEqual([]);
  });

  it('carries null text for a resolved thread with no comments', () => {
    const prev = [shape('a', { commentThread: { comments: [], resolved: false } })];
    const next = [shape('a', { commentThread: { comments: [], resolved: true } })];
    expect(newlyResolvedThreads(next, prev)).toEqual([{ elementId: 'a', text: null }]);
  });
});

describe('newComments', () => {
  it('returns only comments whose id is new', () => {
    const prev = [shape('a', { commentThread: { comments: [comment('c1', 'old')] } })];
    const next = [
      shape('a', { commentThread: { comments: [comment('c1', 'old'), comment('c2', 'new')] } }),
    ];
    expect(newComments(next, prev).map((c) => c.id)).toEqual(['c2']);
  });
});

describe('actions', () => {
  const action = (status: 'open' | 'done') => ({
    id: 'act1',
    name: 'Wire up webhooks',
    status,
    assignee: { userId: 'sam', name: 'Sam' },
  });

  it('sees an action appear and later complete, once each', () => {
    const before = [shape('a')];
    const assigned = [shape('a', { action: action('open') })];
    const done = [shape('a', { action: action('done') })];
    expect(newActions(assigned, before).map((a) => a.id)).toEqual(['act1']);
    expect(newActions(done, assigned)).toEqual([]);
    expect(completedActions(done, assigned).map((a) => a.id)).toEqual(['act1']);
    expect(completedActions(done, done)).toEqual([]);
  });
});
