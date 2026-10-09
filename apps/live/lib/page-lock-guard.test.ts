import { describe, expect, it, vi } from 'vitest';
import { layOutIllustratePages, type Element, type Tab } from '@livediagram/document';
import { announcePageLocked, guardLockedPagesIn } from './page-lock-guard';

// docs/specs/007-editor/illustrate-pages.md "Locking a page": the commit choke point's guard.
const pages = [{ id: 'a', orientation: 'portrait' as const, locked: true as const }];
const r = layOutIllustratePages(pages)[0]!.rect;
const tab = (elements: Element[]): Tab => ({ id: 't', name: 'T', elements, pages }) as Tab;
const box = {
  id: 'x',
  type: 'shape',
  shape: 'square',
  x: r.x + 50,
  y: r.y + 50,
  width: 20,
  height: 20,
} as Element;

describe('guardLockedPagesIn', () => {
  it('holds back an addition to the guarded tab’s locked page, and says so', () => {
    const onBlocked = vi.fn();
    const out = guardLockedPagesIn([tab([])], [tab([box])], { tabId: 't', onBlocked });
    expect(out[0]!.elements).toEqual([]);
    expect(onBlocked).toHaveBeenCalled();
  });

  it('passes edits through with no guard (outside Illustrate) or on another tab', () => {
    const next = [tab([box])];
    expect(guardLockedPagesIn([tab([])], next, null)).toBe(next);
    expect(guardLockedPagesIn([tab([])], next, { tabId: 'other', onBlocked: vi.fn() })).toBe(next);
  });
});

describe('announcePageLocked', () => {
  it('says why once in a while, not on every held-back tick', () => {
    const toast = vi.fn();
    announcePageLocked(toast, 1_000_000);
    announcePageLocked(toast, 1_000_100);
    expect(toast).toHaveBeenCalledTimes(1);
    announcePageLocked(toast, 1_010_000);
    expect(toast).toHaveBeenCalledTimes(2);
  });
});
