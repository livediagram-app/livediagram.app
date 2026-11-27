// @vitest-environment jsdom
// Opening a page (docs/specs/030-knowledgebase/page-surface.md "Switching pages", Work Tracker 1465): the switch runs
// as a `page-switch` View Transition, plainly under reduced motion, and the open page is never switched to again.
import { afterEach, describe, expect, it, vi } from 'vitest';

const react = vi.hoisted(() => ({ types: [] as string[], transitions: 0 }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    startTransition: (fn: () => void) => {
      react.transitions += 1;
      fn();
    },
    addTransitionType: (type: string) => react.types.push(type),
  };
});
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('@liveworkspace/workbench/lib/motion-preference', () => ({
  prefersReducedMotion: () => motion.reduced,
}));

import type { EditorContextValue } from '@/app/document/[id]/EditorContext';
import { PAGE_SWITCH_TRANSITION } from '@/components/page-surface/page-switch-transition';
import { PAGE_FETCH_WAIT_MS, selectPage } from './select-page';

const editor = (activeId = 'a') => {
  const e = {
    activeId,
    setActiveId: vi.fn(),
    setSelectedId: vi.fn(),
    setMultiSelectedIds: vi.fn(),
    setEditingId: vi.fn(),
    setFormatSourceId: vi.fn(),
  };
  return e as typeof e & EditorContextValue;
};

const unopened = (loadAllTabs: (ids: string[]) => Promise<unknown>) => {
  const e = editor();
  Object.assign(e, {
    hydrated: true,
    loadedTabIds: new Set(['a']),
    loadAllTabs: vi.fn(loadAllTabs),
  });
  return e;
};

afterEach(() => {
  vi.useRealTimers();
  react.types = [];
  react.transitions = 0;
  motion.reduced = false;
});

describe('selectPage', () => {
  it('opens the page as a page-switch transition, with nothing selected following it', () => {
    const e = editor();
    selectPage(e, 'b');
    expect(react.transitions).toBe(1);
    expect(react.types).toEqual([PAGE_SWITCH_TRANSITION]);
    expect(e.setActiveId).toHaveBeenCalledWith('b');
    expect(e.setSelectedId).toHaveBeenCalledWith(null);
    expect(e.setMultiSelectedIds).toHaveBeenCalledWith(new Set());
    expect(e.setEditingId).toHaveBeenCalledWith(null);
    expect(e.setFormatSourceId).toHaveBeenCalledWith(null);
  });

  it('switches at once, with no transition, under reduced motion', () => {
    motion.reduced = true;
    const e = editor();
    selectPage(e, 'b');
    expect(react.transitions).toBe(0);
    expect(e.setActiveId).toHaveBeenCalledWith('b');
  });

  it('does nothing for the page already open', () => {
    const e = editor('a');
    selectPage(e, 'a');
    expect(react.transitions).toBe(0);
    expect(e.setActiveId).not.toHaveBeenCalled();
  });

  it('fetches a page not opened yet first, keeping the page before on screen until it is here', async () => {
    let land!: () => void;
    const e = unopened(() => new Promise<void>((r) => (land = r)));
    selectPage(e, 'b');
    expect(e.loadAllTabs).toHaveBeenCalledWith(['b']);
    expect(e.setActiveId).not.toHaveBeenCalled();
    land();
    await vi.waitFor(() => expect(e.setActiveId).toHaveBeenCalledWith('b'));
    expect(react.types).toEqual([PAGE_SWITCH_TRANSITION]);
  });

  it('switches anyway when the fetch fails', async () => {
    const e = unopened(() => Promise.reject(new Error('offline')));
    selectPage(e, 'b');
    await vi.waitFor(() => expect(e.setActiveId).toHaveBeenCalledWith('b'));
  });

  it('lets the latest press win while an earlier page is still fetching', async () => {
    let landB!: () => void;
    const e = unopened((ids) =>
      ids[0] === 'b' ? new Promise<void>((r) => (landB = r)) : Promise.resolve(),
    );
    selectPage(e, 'b');
    selectPage(e, 'c');
    await vi.waitFor(() => expect(e.setActiveId).toHaveBeenCalledWith('c'));
    landB();
    await new Promise((r) => setTimeout(r, 0));
    expect(e.setActiveId).not.toHaveBeenCalledWith('b');
  });

  it('caps the wait, switching onto the page loader when the fetch never lands', async () => {
    vi.useFakeTimers();
    const e = unopened(() => new Promise<void>(() => {}));
    selectPage(e, 'b');
    await vi.advanceTimersByTimeAsync(PAGE_FETCH_WAIT_MS - 1);
    expect(e.setActiveId).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(e.setActiveId).toHaveBeenCalledWith('b');
  });

  it('switches at once to a page already loaded', () => {
    const e = unopened(() => Promise.resolve());
    e.loadedTabIds.add('b');
    selectPage(e, 'b');
    expect(e.loadAllTabs).not.toHaveBeenCalled();
    expect(e.setActiveId).toHaveBeenCalledWith('b');
  });
});
