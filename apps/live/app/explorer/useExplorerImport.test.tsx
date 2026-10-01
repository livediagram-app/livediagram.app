// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderHook, render, screen, fireEvent } from '@testing-library/react';
import { useExplorerImport } from './useExplorerImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/013-workspace/folders.md "Import from".
describe('useExplorerImport', () => {
  it('offers no imports before the owner is known', () => {
    const { result } = renderHook(() =>
      useExplorerImport({ ownerId: null, folderId: null, onDocumentsCreated: vi.fn() }),
    );
    expect(result.current.toolbar).toBeNull();
    expect(result.current.dialogs).toBeNull();
  });

  it('offers Microsoft Whiteboard, whose button opens its dialog', () => {
    const { result, rerender } = renderHook(() =>
      useExplorerImport({ ownerId: 'owner', folderId: 'f1', onDocumentsCreated: vi.fn() }),
    );
    render(<>{result.current.toolbar}</>);
    fireEvent.click(screen.getByRole('button', { name: 'Import from Microsoft Whiteboard' }));
    rerender();
    expect(result.current.dialogs).not.toBeNull();
  });
});

describe('the Excalidraw source', () => {
  it('opens its own dialog from its button', () => {
    const { result, rerender } = renderHook(() =>
      useExplorerImport({ ownerId: 'owner', folderId: null, onDocumentsCreated: vi.fn() }),
    );
    expect(result.current.dialogs).toBeNull();
    render(<>{result.current.toolbar}</>);
    fireEvent.click(screen.getByRole('button', { name: 'Import from Excalidraw' }));
    rerender();
    expect(result.current.dialogs).not.toBeNull();
  });
});
