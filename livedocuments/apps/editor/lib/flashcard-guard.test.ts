import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  layOutPages,
  newFlashcardPage,
  pagesOf,
  type Element,
  type Tab,
} from '@livedocuments/document';
import {
  announceTextOnly,
  guardFlashcardsIn,
  setTextOnlyToast,
  TEXT_ONLY_NOTICE,
} from './flashcard-guard';

// docs/specs/007-editor/flashcards.md "Text only": the commit choke point's side.
const stack = (elements: Element[] = []): Tab =>
  ({ id: 't1', elements, pages: [newFlashcardPage('c1', 'f1')] }) as unknown as Tab;
const rect = () => layOutPages(pagesOf(stack()))[0]!.rect;
const box = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 40, height: 40 }) as unknown as Element;

afterEach(() => setTextOnlyToast(null));

describe('guardFlashcardsIn', () => {
  it('holds back an element added onto a card, and says so', () => {
    const r = rect();
    const before = [stack()];
    const after = [stack([box('pic', r.x + 50, r.y + 50)])];
    const onBlocked = vi.fn();
    const out = guardFlashcardsIn(before, after, 't1', onBlocked);
    expect(out).not.toBe(after);
    expect(out[0]!.elements).toEqual([]);
    expect(onBlocked).toHaveBeenCalledOnce();
  });

  it('passes an element off the cards, and any other tab, untouched', () => {
    const r = rect();
    const before = [stack()];
    const after = [stack([box('aside', r.x + r.width + 200, r.y)])];
    const onBlocked = vi.fn();
    expect(guardFlashcardsIn(before, after, 't1', onBlocked)).toBe(after);
    expect(guardFlashcardsIn(before, after, 'other', onBlocked)).toBe(after);
    expect(guardFlashcardsIn(before, after, null, onBlocked)).toBe(after);
    expect(guardFlashcardsIn(before, before, 't1', onBlocked)).toBe(before);
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('passes an edit that leaves the elements as they were', () => {
    const before = [stack()];
    const after: Tab[] = [{ ...before[0]!, name: 'Renamed' }];
    expect(guardFlashcardsIn(before, after, 't1', vi.fn())).toBe(after);
  });
});

describe('the notice', () => {
  it('goes to the toast at most once in a stretch', () => {
    const toast = vi.fn();
    setTextOnlyToast(toast);
    announceTextOnly(1_000_000);
    announceTextOnly(1_000_500);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(TEXT_ONLY_NOTICE);
    announceTextOnly(1_010_000);
    expect(toast).toHaveBeenCalledTimes(2);
  });

  it('says nothing before the editor mounts its toast', () => {
    expect(() => announceTextOnly(2_000_000)).not.toThrow();
  });
});
