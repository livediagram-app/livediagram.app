// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MS_WHITEBOARD_IMPORT_TITLE, MsWhiteboardImportDialog } from './MsWhiteboardImportDialog';
import { useMsWhiteboardImportLauncher } from '@/hooks/persistence/useMsWhiteboardImportLauncher';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/020-import-export/blueprints/ms-whiteboard-import.md "Presentation and UX".
describe('MsWhiteboardImportDialog', () => {
  it('is a labelled dialog holding the panel, with no way back, closing on its close button', () => {
    const onClose = vi.fn();
    render(<MsWhiteboardImportDialog importScenes={vi.fn()} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: MS_WHITEBOARD_IMPORT_TITLE })).toBeTruthy();
    expect(
      screen.getByText('Each board becomes its own document, named and dated as the board.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a .zip' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /All formats/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('useMsWhiteboardImportLauncher', () => {
  it('opens only when the host can commit', () => {
    const none = renderHook(() => useMsWhiteboardImportLauncher(undefined));
    expect(none.result.current.openMicrosoftWhiteboardImport).toBeUndefined();
    const some = renderHook(() => useMsWhiteboardImportLauncher(vi.fn()));
    expect(some.result.current.dialog).toBeNull();
    act(() => some.result.current.openMicrosoftWhiteboardImport!());
    expect(some.result.current.dialog).not.toBeNull();
  });
});
