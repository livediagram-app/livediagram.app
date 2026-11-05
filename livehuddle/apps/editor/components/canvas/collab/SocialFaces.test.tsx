// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livehuddle/document';
import { isPieceControlPress } from '@/lib/piece-control';

// docs/specs/009-elements/social-pieces.md "A face's controls are their own": a press on the Notes button or the
// Jukebox's Play never reaches the element around it (select, drag, label edit), and the canvas's capture handlers
// (walk, erase, marquee, draw, double-tap) see it as a piece control.

vi.mock('@/app/document/[id]/EditorContext', () => ({ useOptionalEditorContext: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { SocialFace } from './SocialFaces';

const piece = (shape: ShapeElement['shape'], over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: shape,
  type: 'shape',
  shape,
  x: 0,
  y: 0,
  width: 176,
  height: 128,
  ...over,
});

function inElement(element: ShapeElement) {
  const onPointerDown = vi.fn();
  const onDoubleClick = vi.fn();
  render(
    <div data-element-id={element.id} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      <SocialFace element={element} />
    </div>,
  );
  return { onPointerDown, onDoubleClick };
}

describe('a social face control keeps its press', () => {
  it.each<[ShapeElement['shape'], RegExp]>([
    ['notice-board', /Open Notes/],
    ['jukebox', /Play|Mute|Unmute|Can't Play/],
  ])('%s: never selects or label-edits the piece', (shape, name) => {
    const element = piece(shape, { jukeboxSource: 'https://example.com/a.mp3' });
    const parent = inElement(element);
    const button = screen.getByRole('button', { name });
    fireEvent.pointerDown(button);
    fireEvent.doubleClick(button);
    expect(parent.onPointerDown).not.toHaveBeenCalled();
    expect(parent.onDoubleClick).not.toHaveBeenCalled();
    expect(isPieceControlPress(button)).toBe(true);
    expect(isPieceControlPress(button.parentElement)).toBe(false);
  });

  it('shows the note count as a badge, never in brackets', () => {
    const note = (id: string) => ({ id, text: id, author: 'Sam', by: 'k', at: 1 });
    inElement(piece('notice-board', { noticeNotes: [note('a'), note('b'), note('c')] }));
    const button = screen.getByRole('button', { name: 'Open Notes, 3 pinned' });
    expect(button.textContent).not.toContain('(');
    expect(button.textContent).toContain('3');
  });

  it('reads nothing as a piece control off the DOM', () => {
    expect(isPieceControlPress(null)).toBe(false);
  });
});

// docs/specs/008-canvas/avatar-mode.md "The reader": while walking, a reading piece opens large on screen.
describe('the reader while walking', () => {
  const note = { id: 'n', title: 'Lunch', text: 'Pizza at one', author: 'Sam', by: 'k', at: 1 };

  it('opens the Notice Board large from a press anywhere on it, and closes on Escape', () => {
    render(<SocialFace element={piece('notice-board', { noticeNotes: [note] })} walking />);
    fireEvent.click(screen.getByRole('button', { name: 'Read the Notice Board' }));
    const dialog = screen.getByRole('dialog', { name: 'Notice Board' });
    expect(dialog.textContent).toContain('Pizza at one');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the reader from the Notes button while walking, the popover otherwise', () => {
    const { unmount } = render(
      <SocialFace element={piece('notice-board', { noticeNotes: [note] })} walking />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Open Notes/ }));
    expect(document.querySelector('[data-notice-reader]')).not.toBeNull();
    unmount();
    render(<SocialFace element={piece('notice-board', { noticeNotes: [note] })} />);
    expect(screen.queryByRole('button', { name: 'Read the Notice Board' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Open Notes/ }));
    expect(document.querySelector('[data-notice-reader]')).toBeNull();
  });

  it('opens every World Clock zone large, past the three the face shows', () => {
    const zones = ['London', 'Paris', 'Tokyo', 'Sydney'].map((label) => ({
      zone: 'UTC',
      label,
    }));
    render(<SocialFace element={piece('world-clock', { clockZones: zones })} walking />);
    fireEvent.click(screen.getByRole('button', { name: 'Read the World Clock' }));
    const dialog = screen.getByRole('dialog', { name: 'World Clock' });
    for (const z of zones) expect(dialog.textContent).toContain(z.label);
    // The bar's Close (the backdrop is a second, untabbable Close).
    const close = screen.getAllByRole('button', { name: 'Close' }).find((b) => b.tabIndex !== -1);
    fireEvent.click(close!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
