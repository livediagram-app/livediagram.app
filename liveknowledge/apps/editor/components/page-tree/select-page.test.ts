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
import { selectPage } from './select-page';

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

afterEach(() => {
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
});
