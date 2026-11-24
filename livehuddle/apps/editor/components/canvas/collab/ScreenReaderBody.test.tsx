// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livehuddle/document';
import {
  resetCallSelf,
  setCallActions,
  setCallSelf,
  type CallActions,
} from '@/lib/calls/calls-store';
import { closeScreenPicker, screenPickerOpen } from '@/lib/office/screen-picker-store';
import { ScreenReaderBody } from './ScreenReaderBody';

let editor: unknown = null;
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => editor,
}));

const element = {
  id: 's1',
  type: 'shape',
  shape: 'screen',
  x: 0,
  y: 0,
  width: 160,
  height: 90,
} as ShapeElement;

const actions = (toggleScreen = vi.fn()): CallActions => ({
  join: vi.fn(),
  toggleMute: vi.fn(),
  toggleCamera: vi.fn(),
  toggleScreen,
  raiseHand: vi.fn(),
  lowerHand: vi.fn(),
});

afterEach(() => {
  editor = null;
  act(() => closeScreenPicker());
  act(() => {
    setCallActions(null);
    resetCallSelf();
  });
});

describe('ScreenReaderBody', () => {
  it('is the empty state alone for someone who may neither share nor set the link', () => {
    editor = { can: { level: 'view' }, setScreenSourceOf: vi.fn() };
    render(<ScreenReaderBody element={element} />);
    expect(screen.getByText('Nothing on the Screen yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share Your Screen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose What It Shows' })).toBeNull();
  });

  it("shares through the call control's own action, as the call allows (a preview with no call)", () => {
    const toggleScreen = vi.fn();
    act(() => {
      setCallActions(actions(toggleScreen));
      setCallSelf({ canPreviewScreen: true });
    });
    render(<ScreenReaderBody element={element} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share Your Screen' }));
    expect(toggleScreen).toHaveBeenCalledTimes(1);
  });

  it('offers no Share when the call allows neither sharing nor a preview', () => {
    act(() => setCallActions(actions()));
    render(<ScreenReaderBody element={element} />);
    expect(screen.queryByRole('button', { name: 'Share Your Screen' })).toBeNull();
  });

  it('opens Show on the Screen for an Editor, on this Screen, closing the reader', () => {
    editor = { can: { level: 'edit' }, setScreenSourceOf: vi.fn() };
    const onClose = vi.fn();
    render(<ScreenReaderBody element={element} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose What It Shows' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screenPickerOpen()).toEqual({ elementId: 's1', tab: 'file' });
  });

  it('opens on Video for a Screen that has a video link', () => {
    editor = { can: { level: 'edit' }, setScreenSourceOf: vi.fn() };
    render(
      <ScreenReaderBody element={{ ...element, screenUrl: 'https://youtu.be/dQw4w9WgXcQ' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose What It Shows' }));
    expect(screenPickerOpen()).toEqual({ elementId: 's1', tab: 'video' });
  });
});
