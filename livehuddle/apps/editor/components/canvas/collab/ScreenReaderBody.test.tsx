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
  leave: vi.fn(),
  toggleMute: vi.fn(),
  toggleCamera: vi.fn(),
  toggleScreen,
  raiseHand: vi.fn(),
  lowerHand: vi.fn(),
});

afterEach(() => {
  editor = null;
  act(() => {
    setCallActions(null);
    resetCallSelf();
  });
});

describe('ScreenReaderBody', () => {
  it('is the empty state alone for someone who may neither share nor set the link', () => {
    editor = { can: { level: 'view' }, setScreenUrlOf: vi.fn() };
    render(<ScreenReaderBody element={element} />);
    expect(screen.getByText('Nothing on the Screen yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share Your Screen' })).toBeNull();
    expect(screen.queryByLabelText('Video Link')).toBeNull();
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

  it("sets an Editor's video link on this Screen, and refuses a link that is not a video", () => {
    const setScreenUrlOf = vi.fn();
    editor = { can: { level: 'edit' }, setScreenUrlOf };
    render(<ScreenReaderBody element={element} />);
    const input = screen.getByLabelText('Video Link');
    fireEvent.change(input, { target: { value: 'example.com/page' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Link' }));
    expect(screen.getByRole('alert').textContent).toContain("isn't a video link");
    expect(setScreenUrlOf).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'youtu.be/dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Link' }));
    expect(setScreenUrlOf).toHaveBeenCalledWith('s1', 'https://youtu.be/dQw4w9WgXcQ');
  });

  it('keeps typed keys from the editor, but lets Escape close the reader', () => {
    editor = { can: { level: 'edit' }, setScreenUrlOf: vi.fn() };
    const onKey = vi.fn();
    render(
      <div onKeyDown={onKey}>
        <ScreenReaderBody element={element} />
      </div>,
    );
    const input = screen.getByLabelText('Video Link');
    fireEvent.keyDown(input, { key: 'w' });
    expect(onKey).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it('says the link is set once the Screen has one', () => {
    render(
      <ScreenReaderBody element={{ ...element, screenUrl: 'https://youtu.be/dQw4w9WgXcQ' }} />,
    );
    expect(screen.getByText('Video link set')).toBeTruthy();
  });
});
