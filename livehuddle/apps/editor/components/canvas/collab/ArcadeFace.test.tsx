// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { avatarKeyClaimed } from '@liveworkspace/avatar/key-claims';
import { modalClosed, modalOpened } from '@liveworkspace/workbench/lib/modal-guard';

// docs/specs/009-elements/social-pieces.md "Arcade Machine", "The panel": the machine's face while you stand at it,
// and the panel it loads.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useOptionalEditorContext: () => null }));
const near = vi.hoisted(() => ({ on: false }));
vi.mock('./useSocialPieces', () => ({ useNearArcade: () => near.on }));

import { isPieceControlPress } from '@/lib/piece-control';
import { ArcadeFace } from './ArcadeFace';
import { SocialFace } from './SocialFaces';

const machine = (): ShapeElement => ({ ...createShape('arcade-machine', 0, 0), id: 'arc' });
const press = () => screen.queryByRole('button', { name: 'Play Moon Mail' });

beforeEach(() => {
  near.on = true;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ArcadeFace', () => {
  it('draws nothing away from the machine, so a click walks to its front', () => {
    near.on = false;
    const { container } = render(<ArcadeFace element={machine()} />);
    expect(container.innerHTML).toBe('');
    expect(avatarKeyClaimed({ key: 'Enter' })).toBe(false);
  });

  it('shows Insert Coin at the machine, the whole cabinet one press of its own', () => {
    render(<SocialFace element={machine()} />);
    expect(screen.getByRole('status').textContent).toBe('Insert Coin');
    const button = press()!;
    expect(button.textContent).toBe('Insert Coin');
    expect(isPieceControlPress(button)).toBe(true);
    expect(button.hasAttribute('data-piece-main')).toBe(true);
  });

  it('opens Moon Mail on a press, Loading… until its code is in', async () => {
    render(<ArcadeFace element={machine()} />);
    fireEvent.click(press()!);
    expect(screen.getByRole('dialog', { name: 'Moon Mail' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Viewers See the Scores')).toBeTruthy();
    // Closed with its Close button, the face is back to its bubble.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(press()).not.toBeNull();
  });

  it('takes Enter and Space from the walk and the message box while you stand there, and opens on either', async () => {
    render(<ArcadeFace element={machine()} />);
    expect(avatarKeyClaimed({ key: 'Enter' })).toBe(true);
    expect(avatarKeyClaimed({ key: ' ' })).toBe(true);
    expect(avatarKeyClaimed({ key: 'Enter', shiftKey: true })).toBe(false);
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(await screen.findByText('Viewers See the Scores')).toBeTruthy();
    // Open, the panel holds them itself.
    expect(avatarKeyClaimed({ key: 'Enter' })).toBe(false);
  });

  it('leaves Enter and Space to a field, a focused button, a held-down key and an open dialog', () => {
    render(
      <>
        <input aria-label="Field" />
        <button type="button">Other</button>
        <ArcadeFace element={machine()} />
      </>,
    );
    const tryKey = (target: Window | Element, init: KeyboardEventInit) =>
      act(() => {
        fireEvent.keyDown(target, init);
      });
    tryKey(screen.getByRole('textbox', { name: 'Field' }), { key: ' ' });
    tryKey(screen.getByRole('button', { name: 'Other' }), { key: 'Enter' });
    tryKey(window, { key: 'Enter', repeat: true });
    modalOpened();
    tryKey(window, { key: ' ' });
    modalClosed();
    expect(screen.queryByRole('dialog')).toBeNull();
    tryKey(window, { key: ' ' });
    expect(screen.getByRole('dialog', { name: 'Moon Mail' })).toBeTruthy();
  });
});
