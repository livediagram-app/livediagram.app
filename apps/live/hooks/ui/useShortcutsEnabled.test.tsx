// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShortcutsEnabled } from './useShortcutsEnabled';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const KEY = 'livediagram:v2:shortcuts-enabled';

afterEach(() => window.localStorage.clear());

// The per-device shortcuts switch (docs/specs/007-editor/live-app.md).
describe('useShortcutsEnabled', () => {
  it('reads the stored switch', () => {
    window.localStorage.setItem(KEY, 'false');
    const { result } = renderHook(() => useShortcutsEnabled());
    expect(result.current.enabled).toBe(false);
  });

  it('persists a flip', () => {
    const { result } = renderHook(() => useShortcutsEnabled());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe('false');
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
  });

  it('keeps every reader in step, so a Settings flip reaches the editor', () => {
    const editor = renderHook(() => useShortcutsEnabled());
    const settings = renderHook(() => useShortcutsEnabled());
    act(() => settings.result.current.setEnabled(false));
    expect(editor.result.current.enabled).toBe(false);
  });
});
