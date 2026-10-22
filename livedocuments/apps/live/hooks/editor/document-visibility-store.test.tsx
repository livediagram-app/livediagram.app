// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDocumentVisibility, usePublishDocumentVisibility } from './document-visibility-store';

// docs/specs/013-workspace/explorer-structure.md "Layout": the Explorer card reads the header badge's visibility.
describe('the document visibility store', () => {
  it('publishes the editor visibility, Manage calling the latest handler, and clears it on unmount', () => {
    const reader = renderHook(() => useDocumentVisibility());
    expect(reader.result.current).toBeNull();
    const first = vi.fn();
    const second = vi.fn();
    const editor = renderHook(
      ({ manage }) => usePublishDocumentVisibility(true, false, false, manage),
      { initialProps: { manage: first as (() => void) | undefined } },
    );
    reader.rerender();
    expect(reader.result.current).toMatchObject({ shareable: true, team: false, offline: false });
    editor.rerender({ manage: second });
    reader.result.current?.onManage?.();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    editor.rerender({ manage: undefined });
    reader.rerender();
    expect(reader.result.current?.onManage).toBeUndefined();
    editor.unmount();
    reader.rerender();
    expect(reader.result.current).toBeNull();
  });
});
