// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { avatarKeyClaimed } from '@livehuddle/avatar/key-claims';
import { modalClosed, modalOpened } from '@liveworkspace/workbench/lib/modal-guard';

// docs/specs/009-elements/social-pieces.md "Arcade Machine", "The panel": the machine's face while you stand at it,
// and the panel it loads.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useOptionalEditorContext: () => null }));
const near = vi.hoisted(() => ({ on: false, below: false }));
vi.mock('./useSocialPieces', () => ({
  useNearArcade: () => near.on,
  useArcadeBubbleBelow: () => near.on && near.below,
}));

import { isPieceControlPress } from '@/lib/piece-control';
import { ArcadeFace } from './ArcadeFace';
import { SocialFace } from './SocialFaces';

const machine = (): ShapeElement => ({ ...createShape('arcade-machine', 0, 0), id: 'arc' });
const press = () => screen.queryByRole('button', { name: 'Play Moon Mail' });

beforeEach(() => {
  near.on = true;
  near.below = false;
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

  // Work Tracker 793: a Room Sign placed by hand just above the machine would sit under the bubble.
  it('shows Insert Coin below the cabinet when a Room Sign stands where it rises', () => {
    const bubble = () => press()!.querySelector('.lh-coin-bubble') as HTMLElement;
    const { rerender } = render(<ArcadeFace element={machine()} />);
    expect(bubble().hasAttribute('data-bubble-below')).toBe(false);
    expect(bubble().style.getPropertyValue('--lh-bubble-rise')).toBe('6px');
    near.below = true;
    rerender(<ArcadeFace element={{ ...machine() }} />);
    expect(bubble().hasAttribute('data-bubble-below')).toBe(true);
    expect(bubble().className).toContain('top-[calc(100%+6px)]');
    expect(bubble().style.getPropertyValue('--lh-bubble-rise')).toBe('-6px');
  });

  it("adds the table's best under Insert Coin, and follows the table as it changes", () => {
    const at = (scores: ShapeElement['arcadeScores']) => ({ ...machine(), arcadeScores: scores });
    const ann = { id: 's1', name: 'Ann', score: 1240, ms: 60_000, by: 'k', at: 1 };
    const { rerender } = render(<ArcadeFace element={at([ann])} />);
    expect(press()!.textContent).toBe('Insert CoinBest 1,240 ·Ann');
    expect(screen.getByRole('status').textContent).toBe('Insert Coin. Best 1,240 by Ann');
    // A better score lands from another screen.
    rerender(<ArcadeFace element={at([{ ...ann, id: 's2', name: 'Bo', score: 2000 }, ann])} />);
    expect(screen.getByRole('status').textContent).toBe('Insert Coin. Best 2,000 by Bo');
    // Cleared: Insert Coin alone.
    rerender(<ArcadeFace element={at(undefined)} />);
    expect(press()!.textContent).toBe('Insert Coin');
    expect(document.querySelector('[data-arcade-best]')).toBeNull();
  });

  it('opens Moon Mail on a press, Loading… until its code is in', async () => {
    // Laid out, so the focus trap sees Close as a control it could focus.
    const laidOut = vi
      .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
      .mockReturnValue(document.body);
    render(<ArcadeFace element={machine()} />);
    fireEvent.click(press()!);
    expect(screen.getByRole('dialog', { name: 'Moon Mail' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    // Focus on the panel while it loads, never on Close, where a Space would close it.
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    laidOut.mockRestore();
    // The first open transforms and loads the panel's whole chunk, which takes a while on a busy machine.
    expect(
      await screen.findByText('Viewers See the Scores', undefined, { timeout: 10_000 }),
    ).toBeTruthy();
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

  it('opens on Space ahead of the canvas, whose held-Space pan takes Space on the document', async () => {
    // The canvas's pan (useCanvasPanAndMarquee) prevents Space's default on the document.
    const pan = vi.fn((e: KeyboardEvent) => e.preventDefault());
    document.addEventListener('keydown', pan);
    render(<ArcadeFace element={machine()} />);
    act(() => {
      fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    });
    expect(await screen.findByText('Viewers See the Scores')).toBeTruthy();
    expect(pan).not.toHaveBeenCalled();
    document.removeEventListener('keydown', pan);
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
