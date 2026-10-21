// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { track } from '@/lib/telemetry';
import {
  finishRestore,
  isMaximisedPlanClosing,
  getMaximisedPlanId,
  maximisePlanElement,
  releasePlanElement,
  restorePlanElement,
  useMaximisedPlanId,
} from './maximised-plan';
import {
  escapeRestores,
  flipTransform,
  useMaximisedPlanLifetime,
} from '@/components/plan/MaximisedPlanLayer';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => {
  finishRestore();
  releasePlanElement(getMaximisedPlanId() ?? '');
  vi.mocked(track).mockClear();
  document.body.innerHTML = '';
});

describe('the maximised board', () => {
  it('maximises and restores one board, with its telemetry', () => {
    const { result } = renderHook(() => useMaximisedPlanId());
    expect(result.current).toBeNull();
    act(() => maximisePlanElement('b1'));
    expect(result.current).toBe('b1');
    expect(track).toHaveBeenLastCalledWith('Plan', 'Toggled', 'BoardMaximised');
    act(() => restorePlanElement());
    // It shrinks back first: still maximised, closing, until the layer finishes the restore.
    expect(result.current).toBe('b1');
    expect(isMaximisedPlanClosing()).toBe(true);
    act(() => finishRestore());
    expect(result.current).toBeNull();
    expect(isMaximisedPlanClosing()).toBe(false);
    expect(track).toHaveBeenLastCalledWith('Plan', 'Toggled', 'BoardRestored');
  });

  it('names a view in its telemetry, both ways', () => {
    maximisePlanElement('v1', 'View');
    expect(track).toHaveBeenLastCalledWith('Plan', 'Toggled', 'ViewMaximised');
    restorePlanElement();
    expect(track).toHaveBeenLastCalledWith('Plan', 'Toggled', 'ViewRestored');
  });

  it('sends nothing for a repeat, or a restore with nothing maximised', () => {
    maximisePlanElement('b1');
    maximisePlanElement('b1');
    restorePlanElement();
    restorePlanElement();
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('lets go of only its own board, silently', () => {
    maximisePlanElement('b1');
    vi.mocked(track).mockClear();
    releasePlanElement('b2');
    expect(getMaximisedPlanId()).toBe('b1');
    releasePlanElement('b1');
    expect(getMaximisedPlanId()).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('its lifetime', () => {
  it('ends when the board unmounts', () => {
    maximisePlanElement('b1');
    const { unmount } = renderHook(() => useMaximisedPlanLifetime('b1', true, true));
    unmount();
    expect(getMaximisedPlanId()).toBeNull();
  });

  it('ends when the board leaves Plan mode', () => {
    maximisePlanElement('b1');
    const { rerender } = renderHook(
      ({ interactive }) => useMaximisedPlanLifetime('b1', true, interactive),
      { initialProps: { interactive: true } },
    );
    expect(getMaximisedPlanId()).toBe('b1');
    rerender({ interactive: false });
    expect(getMaximisedPlanId()).toBeNull();
  });

  it('restores on Escape', () => {
    maximisePlanElement('b1');
    renderHook(() => useMaximisedPlanLifetime('b1', true, true));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(isMaximisedPlanClosing()).toBe(true);
    finishRestore();
    expect(getMaximisedPlanId()).toBeNull();
  });

  it('lays the full-screen box over the element’s place, to grow from and shrink to', () => {
    const place = new DOMRect(100, 50, 400, 200);
    const screen = new DOMRect(10, 10, 1000, 800);
    expect(flipTransform(place, screen)).toBe('translate(90px, 40px) scale(0.4, 0.25)');
    expect(flipTransform(place, new DOMRect(0, 0, 0, 0))).toBe('none');
  });

  it('can be maximised again while it is still shrinking back', () => {
    maximisePlanElement('b1');
    restorePlanElement();
    maximisePlanElement('b1');
    expect(isMaximisedPlanClosing()).toBe(false);
    expect(getMaximisedPlanId()).toBe('b1');
  });

  it('leaves Escape to a dialog open over the board', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    expect(escapeRestores({ key: 'Escape', defaultPrevented: false })).toBe(false);
    dialog.remove();
    expect(escapeRestores({ key: 'Escape', defaultPrevented: false })).toBe(true);
    expect(escapeRestores({ key: 'Escape', defaultPrevented: true })).toBe(false);
    expect(escapeRestores({ key: 'Enter', defaultPrevented: false })).toBe(false);
  });

  it('leaves Escape to whatever inside the element uses it (a Sheet edit, its Find bar)', () => {
    const owner = document.createElement('div');
    owner.setAttribute('data-keeps-escape', '');
    const input = document.createElement('input');
    owner.append(input);
    document.body.append(owner);
    expect(escapeRestores({ key: 'Escape', defaultPrevented: false, target: input })).toBe(false);
    expect(escapeRestores({ key: 'Escape', defaultPrevented: false, target: document.body })).toBe(
      true,
    );
    owner.remove();
  });

  it('leaves Escape to an open menu, which closes first', () => {
    const menu = document.createElement('div');
    menu.setAttribute('data-menu-surface', 'control');
    document.body.append(menu);
    expect(escapeRestores({ key: 'Escape', defaultPrevented: false })).toBe(false);
    menu.remove();
    expect(escapeRestores({ key: 'Escape', defaultPrevented: false })).toBe(true);
  });
});
