// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  clearPageEditors,
  myEditingPage,
  notePageEditors,
  notePeerSaved,
  onPeerSaved,
  pageEditorsOf,
  peerEditing,
  setMyEditingPage,
  useMyEditingPage,
  usePageEditors,
} from './page-edit-store';

// docs/specs/030-knowledgebase/editing.md "Edit mode": who is editing which page is presence.

afterEach(() => {
  clearPageEditors();
  setMyEditingPage(null);
});

describe('who is editing', () => {
  it("reads each session's editing page from the roster", () => {
    notePageEditors([
      { id: 'p1', name: 'Priya', color: '#f00', editing: 't1' },
      { id: 'p2', name: ' ', color: '#0f0', editing: 't1', picture: 'https://x/p.png' },
      { id: 'p3', name: 'Sam', color: '#00f' },
      { id: 'p4', name: 'Ana', color: 5, editing: 't2' },
    ]);
    expect(pageEditorsOf('t1').map((e) => e.name)).toEqual(['Priya', 'Someone']);
    expect(pageEditorsOf('t1')[1]!.picture).toBe('https://x/p.png');
    expect(pageEditorsOf('t2')[0]!.color).toBe('');
    expect(pageEditorsOf('t1')).toBe(pageEditorsOf('t1'));
    expect(peerEditing('p1', 't1')).toBe(true);
    expect(peerEditing('p3', 't1')).toBe(false);
  });

  it('renders a reader only when the people change', () => {
    const { result } = renderHook(() => usePageEditors('t1'));
    expect(result.current).toEqual([]);
    act(() => notePageEditors([{ id: 'p1', name: 'Priya', color: '#f00', editing: 't1' }]));
    const first = result.current;
    expect(first.map((e) => e.name)).toEqual(['Priya']);
    act(() => notePageEditors([{ id: 'p1', name: 'Priya', color: '#f00', editing: 't1' }]));
    expect(result.current).toBe(first);
    act(() => clearPageEditors());
    expect(result.current).toEqual([]);
    clearPageEditors();
  });

  it("keeps this editor's own mode", () => {
    const { result } = renderHook(() => useMyEditingPage());
    act(() => setMyEditingPage('t1'));
    expect(result.current).toBe('t1');
    expect(myEditingPage()).toBe('t1');
    setMyEditingPage('t1');
    act(() => setMyEditingPage(null));
    expect(result.current).toBeNull();
  });

  it('tells listeners who saved, by their roster name', () => {
    notePageEditors([{ id: 'p1', name: 'Priya', color: '#f00' }]);
    const heard = vi.fn();
    const off = onPeerSaved(heard);
    notePeerSaved('p1', 't1');
    notePeerSaved('ghost', 't1');
    off();
    notePeerSaved('p1', 't1');
    expect(heard.mock.calls).toEqual([
      ['t1', 'Priya'],
      ['t1', 'Someone'],
    ]);
  });
});
