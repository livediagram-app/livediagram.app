// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  anyModalOpen,
  modalClosed,
  modalOpened,
  openModalCount,
  useAnyModalOpen,
  useOpenModalCount,
} from './modal-guard';

// The one "a modal dialog is open" signal: the window listeners read it, the tours subscribe to it
// (docs/specs/007-editor/pages-tour.md "Dialogs come first").

afterEach(() => {
  while (anyModalOpen()) modalClosed();
});

describe('modal-guard', () => {
  it('counts stacked dialogs, and never below none', () => {
    expect(openModalCount()).toBe(0);
    modalOpened();
    modalOpened();
    expect(openModalCount()).toBe(2);
    modalClosed();
    expect(anyModalOpen()).toBe(true);
    modalClosed();
    modalClosed();
    expect(openModalCount()).toBe(0);
    expect(anyModalOpen()).toBe(false);
  });

  it('re-renders its subscribers as dialogs open and close', () => {
    const count = renderHook(() => useOpenModalCount());
    const any = renderHook(() => useAnyModalOpen());
    act(() => modalOpened());
    expect(count.result.current).toBe(1);
    expect(any.result.current).toBe(true);
    act(() => modalOpened());
    expect(count.result.current).toBe(2);
    act(() => {
      modalClosed();
      modalClosed();
    });
    expect(count.result.current).toBe(0);
    expect(any.result.current).toBe(false);
  });
});
