// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';

// The composed editor state (docs/specs/003-system-architecture/blueprints/editor-state.md "Testing"): the slices
// hand one view-model to the editor, and an edit renders it once. Every request the editor makes is answered 404,
// so the editor opens a fresh, local document.
vi.stubGlobal(
  'fetch',
  vi.fn(
    async () =>
      new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }),
  ),
);

const { useEditorState } = await import('./useEditorState');

const settle = async () => {
  for (let i = 0; i < 5; i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
};

const box = {
  id: 'b1',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  label: '',
} as unknown as Element;

describe('useEditorState', () => {
  it('renders once per edit, once per undo and redo, and not for a zoom', async () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useEditorState();
    });
    await settle();
    expect(result.current.activeTabLoadState).toBe('ready');

    const rendersFor = async (fn: () => void) => {
      const before = renders;
      await act(async () => fn());
      await settle();
      return renders - before;
    };

    expect(await rendersFor(() => result.current.commitElements((els) => [...els, box]))).toBe(1);
    expect(result.current.activeTab.elements.map((e) => e.id)).toEqual(['b1']);
    expect(await rendersFor(() => result.current.undo())).toBe(1);
    expect(result.current.activeTab.elements).toEqual([]);
    expect(await rendersFor(() => result.current.redo())).toBe(1);
    expect(result.current.activeTab.elements.map((e) => e.id)).toEqual(['b1']);
    // The viewport lives in its store: a zoom renders no part of the editor.
    expect(await rendersFor(() => result.current.setViewportZoom(2))).toBe(0);
  }, 60_000);
});
