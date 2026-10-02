// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorMode } from './useEditorMode';

const events: unknown[][] = [];
const stored: (string | null)[] = [];
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => {
    events.push(args);
    // What the mode store held when the event left: the event fires BEFORE the mode applies.
    stored.push(localStorage.getItem('livediagram:v2:editor-mode:' + 'tab-a'));
  },
}));

let seq = 0;
const tabId = () => `tab-${++seq}`;

// docs/specs/007-editor/editor-modes.md "Where the mode lives" and "Telemetry".
describe('useEditorMode', () => {
  beforeEach(() => {
    localStorage.clear();
    events.length = 0;
    stored.length = 0;
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a tab in its opening mode, switchable by an editor', () => {
    const tab = { id: tabId(), opensIn: 'draw' as const };
    const { result } = renderHook(() => useEditorMode(tab, { canEdit: true }));
    expect(result.current.mode).toBe('draw');
    expect(result.current.canSwitch).toBe(true);
  });

  it('switches, remembers the choice for that tab and shares it with every caller', () => {
    const tab = { id: tabId() };
    const a = renderHook(() => useEditorMode(tab, { canEdit: true }));
    const b = renderHook(() => useEditorMode(tab, { canEdit: true }));
    act(() => a.result.current.setMode('draw'));
    expect(a.result.current.mode).toBe('draw');
    expect(b.result.current.mode).toBe('draw');
    expect(localStorage.getItem(`livediagram:v2:editor-mode:${tab.id}`)).toBe('draw');
    const other = renderHook(() => useEditorMode({ id: tabId() }, { canEdit: true }));
    expect(other.result.current.mode).toBe('diagram');
  });

  it('reports the switch before the mode applies', () => {
    const tab = { id: 'tab-a' };
    const { result } = renderHook(() => useEditorMode(tab, { canEdit: true }));
    act(() => result.current.setMode('draw'));
    act(() => result.current.setMode('diagram'));
    expect(events).toEqual([
      ['Editor', 'Changed', 'ModeDraw'],
      ['Editor', 'Changed', 'ModeDiagram'],
    ]);
    expect(stored).toEqual([null, 'draw']);
  });

  it('does nothing when asked for the mode already in use', () => {
    const tab = { id: tabId() };
    const { result } = renderHook(() => useEditorMode(tab, { canEdit: true }));
    act(() => result.current.setMode('diagram'));
    expect(events).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('gives a view-role visitor the opening mode and refuses a switch', () => {
    const tab = { id: tabId(), opensIn: 'draw' as const };
    localStorage.setItem(`livediagram:v2:editor-mode:${tab.id}`, 'diagram');
    const { result } = renderHook(() => useEditorMode(tab, { canEdit: false }));
    expect(result.current).toMatchObject({ mode: 'draw', canSwitch: false });
    act(() => result.current.setMode('diagram'));
    expect(result.current.mode).toBe('draw');
    expect(events).toEqual([]);
  });

  it('keeps an event-storming board in Diagram mode and refuses a switch', () => {
    const tab = { id: tabId(), kind: 'event-storming' as const };
    const { result } = renderHook(() => useEditorMode(tab, { canEdit: true }));
    expect(result.current).toMatchObject({ mode: 'diagram', canSwitch: false });
    act(() => result.current.setMode('draw'));
    expect(result.current.mode).toBe('diagram');
    expect(events).toEqual([]);
  });

  it('follows the active tab: each tab has its own mode', () => {
    const first = { id: tabId() };
    const second = { id: tabId(), opensIn: 'draw' as const };
    const { result, rerender } = renderHook(({ tab }) => useEditorMode(tab, { canEdit: true }), {
      initialProps: { tab: first },
    });
    act(() => result.current.setMode('draw'));
    rerender({ tab: second });
    expect(result.current.mode).toBe('draw');
    act(() => result.current.setMode('diagram'));
    rerender({ tab: first });
    expect(result.current.mode).toBe('draw');
  });
});
