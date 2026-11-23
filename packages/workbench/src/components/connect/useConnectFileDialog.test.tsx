// @vitest-environment jsdom

// The tab bar's Connect a File (liveworkspace/docs/specs/004-index/connected-tabs.md "From the tab bar"), shared by
// every app: nothing where connecting cannot work; a press counts and draws the dialog, whose connect adds the tab at
// the end of the bar (no empty tab gives way) and whose close takes it away.
import { act, renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useConnectFileDialog, type ConnectFileHost } from './useConnectedTabActions';

const host = (): ConnectFileHost => ({
  hostId: 'h1',
  hostKind: 'plan',
  hostManaged: true,
  connected: new Map(),
  grant: vi.fn(),
  newTabId: () => 'n',
  onConnected: vi.fn(),
  onGoTo: vi.fn(),
  addConnectedTab: vi.fn().mockResolvedValue(undefined),
});

describe('useConnectFileDialog', () => {
  it('offers nothing without a host', () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() => useConnectFileDialog(undefined, onOpen));
    expect(result.current).toEqual({ open: undefined, dialog: null });
  });

  it('counts a press, draws the dialog, adds at the end of the bar and closes', () => {
    const onOpen = vi.fn();
    const h = host();
    const { result } = renderHook(() => useConnectFileDialog(h, onOpen));
    expect(result.current.dialog).toBeNull();
    act(() => result.current.open!());
    expect(onOpen).toHaveBeenCalledOnce();
    const dialog = result.current.dialog as ReactElement<{
      hostId: string;
      addTab: (made: never, tabId: string) => Promise<void>;
      onClose: () => void;
    }>;
    expect(dialog.props.hostId).toBe('h1');
    void dialog.props.addTab({ name: 'x' } as never, 't9');
    expect(h.addConnectedTab).toHaveBeenCalledWith({ name: 'x' }, 't9');
    act(() => dialog.props.onClose());
    expect(result.current.dialog).toBeNull();
  });
});
