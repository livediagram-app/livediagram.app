import { describe, expect, it } from 'vitest';
import { CHANGESET_TOAST_COALESCE_MS, type ChangesetRoomOp } from '@livediagram/api-schema';
import {
  changesetToastCopy,
  coalesceChangesetToast,
  touchedIdsOf,
  undoneCopy,
  type ChangesetToast,
} from './changeset-toast';

// The toast a relayed changeset raises (docs/specs/024-agents/blueprints/agent-changesets.md "The
// editor", "Presentation and UX").

const op = (over: Partial<ChangesetRoomOp> = {}): ChangesetRoomOp => ({
  kind: 'changeset',
  tabId: 't1',
  id: 'cs_0000000001',
  rev: 2,
  prevRev: null,
  author: { name: 'Webber', color: '#0ea5e9' },
  agentKey: 'abcabcabcabc',
  summary: 'add payment service',
  counts: { added: 1, changed: 1, removed: 1 },
  elementOps: [
    {
      kind: 'add',
      element: { id: 'n', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 },
      at: 0,
    },
    { kind: 'remove', id: 'r' },
    { kind: 'reorder', ids: ['n'] },
  ],
  ...over,
});

describe('changesetToastCopy', () => {
  it('names the author and every element changed, adds and removals included, then the summary', () => {
    const toast = coalesceChangesetToast(new Map(), op(), 0);
    expect(changesetToastCopy(toast)).toBe('Webber changed 3 elements: add payment service');
  });

  it('reads one element in the singular, and no summary when the latest has none', () => {
    const toast = coalesceChangesetToast(
      new Map(),
      op({ summary: undefined, counts: { added: 0, changed: 1, removed: 0 } }),
      0,
    );
    expect(changesetToastCopy(toast)).toBe('Webber changed 1 element');
  });
});

describe('coalesceChangesetToast', () => {
  it("joins one token's changesets within the window, the latest summary showing", () => {
    const first = coalesceChangesetToast(new Map(), op(), 1000);
    const toasts = new Map<string, ChangesetToast>([[first.key, first]]);
    const next = coalesceChangesetToast(
      toasts,
      op({ id: 'cs_0000000002', summary: 'wire it up' }),
      1000 + CHANGESET_TOAST_COALESCE_MS,
    );
    expect(next).toMatchObject({
      key: 'abcabcabcabc',
      changesetIds: ['cs_0000000001', 'cs_0000000002'],
      count: 6,
      summary: 'wire it up',
    });
  });

  it("starts a new burst after the window, replacing that token's toast", () => {
    const first = coalesceChangesetToast(new Map(), op(), 0);
    const later = coalesceChangesetToast(
      new Map([[first.key, first]]),
      op({ id: 'cs_0000000002' }),
      CHANGESET_TOAST_COALESCE_MS + 1,
    );
    expect(later).toMatchObject({ key: first.key, changesetIds: ['cs_0000000002'], count: 3 });
  });

  it("keys a person's changeset by its own id", () => {
    expect(coalesceChangesetToast(new Map(), op({ agentKey: undefined }), 0).key).toBe(
      'cs_0000000001',
    );
  });
});

describe('touchedIdsOf and undoneCopy', () => {
  it('names every element an op touched, or the touched list of an oversize relay', () => {
    expect(touchedIdsOf(op())).toEqual(['n', 'r']);
    expect(touchedIdsOf(op({ elementOps: undefined, refetch: true, touched: ['x', 'y'] }))).toEqual(
      ['x', 'y'],
    );
  });

  it('says what an Undo left', () => {
    expect(undoneCopy(0)).toBe('Undone');
    expect(undoneCopy(1)).toBe('Undone, 1 kept because it changed since');
    expect(undoneCopy(2)).toBe('Undone, 2 kept because they changed since');
  });
});
