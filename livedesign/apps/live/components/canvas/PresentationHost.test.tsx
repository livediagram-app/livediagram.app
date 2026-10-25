// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRESENTATION_CONFIG } from '@/lib/presentation-config';
import { loadPresentationOverlay } from '@/lib/editor-deferred-code';
import { PresentationHost } from './PresentationHost';

// docs/specs/012-collaboration/presentation-mode.md "Motion" and its blueprint: a move runs in a transition typed by
// its direction, quick presses count from the slide last asked for, and the first slide is revealed as a
// `slide-in` transition once the screen settles.
const deck = {
  presentingAt: 0 as number | null,
  runnable: [
    { slide: { id: 's1' } },
    { slide: { id: 's2' } },
    { slide: { id: 's3' } },
    { slide: { id: 's4' } },
  ],
  config: DEFAULT_PRESENTATION_CONFIG,
  setPresentingAt: vi.fn(),
  exitPresentation: vi.fn(),
  updateConfig: vi.fn(),
};
vi.mock('@/app/design/[id]/EditorContext', () => ({
  useEditorContext: () => ({ slideDeck: deck, canvasTool: 'select', setCanvasTool: vi.fn() }),
}));
vi.mock('@/components/canvas/CanvasSurfaceContext', () => ({ useCanvasSurface: () => 'light' }));
// The overlay's controls, reduced to what they ask of the host: a step either way, and a jump.
vi.mock('@/components/canvas/PresentationOverlay', () => ({
  PresentationOverlay: ({ at, onGo }: { at: number; onGo: (next: number) => void }) => (
    <div data-testid="presentation-overlay">
      <button onClick={() => onGo(at + 1)}>Next</button>
      <button onClick={() => onGo(at - 1)}>Back</button>
      <button onClick={() => onGo(3)}>Jump to 4</button>
    </div>
  ),
}));
const transition = vi.hoisted(() => vi.fn((_type: string, change: () => void) => change()));
vi.mock('@liveworkspace/workbench/lib/view-transition', () => ({ startTypedTransition: transition }));
const settle = vi.hoisted(() => ({ ready: null as null | (() => void) }));
vi.mock('./slide-transition', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./slide-transition')>()),
  whenScreenSettles: (ready: () => void) => {
    settle.ready = ready;
    return () => {
      settle.ready = null;
    };
  },
}));

beforeAll(async () => {
  await loadPresentationOverlay();
});
beforeEach(() => {
  deck.presentingAt = 0;
  deck.config = DEFAULT_PRESENTATION_CONFIG;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  settle.ready = null;
});

const root = document.documentElement;
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('PresentationHost', () => {
  it('holds the first slide until the screen settles, then reveals it as a slide-in', () => {
    render(<PresentationHost />);
    expect(root.getAttribute('data-slide-move')).toBe('pending');
    expect(transition).not.toHaveBeenCalled();
    act(() => settle.ready?.());
    expect(transition).toHaveBeenCalledWith('slide-in', expect.any(Function));
    expect(root.hasAttribute('data-slide-move')).toBe(false);
  });

  it('moves in a transition typed by the direction', () => {
    deck.presentingAt = 1;
    render(<PresentationHost />);
    press('Next');
    expect(transition).toHaveBeenLastCalledWith('slide-forward', expect.any(Function));
    expect(deck.setPresentingAt).toHaveBeenLastCalledWith(2);
    press('Back');
    expect(transition).toHaveBeenLastCalledWith('slide-back', expect.any(Function));
    expect(deck.setPresentingAt).toHaveBeenLastCalledWith(1);
  });

  it('crosses with Fade and cuts with None', () => {
    deck.config = { ...DEFAULT_PRESENTATION_CONFIG, transition: 'fade' };
    const view = render(<PresentationHost />);
    press('Next');
    expect(transition).toHaveBeenLastCalledWith('slide-fade', expect.any(Function));
    transition.mockClear();
    deck.config = { ...DEFAULT_PRESENTATION_CONFIG, transition: 'none' };
    deck.presentingAt = 1;
    view.rerender(<PresentationHost />);
    press('Next');
    expect(transition).not.toHaveBeenCalled();
    expect(deck.setPresentingAt).toHaveBeenLastCalledWith(2);
  });

  it('counts quick presses from the slide last asked for, so every press lands', () => {
    render(<PresentationHost />);
    press('Next');
    press('Next');
    press('Next');
    expect(deck.setPresentingAt.mock.calls.map(([n]): unknown => n)).toEqual([1, 2, 3]);
  });

  it('stops at the end state, past the last slide', () => {
    deck.presentingAt = 3;
    render(<PresentationHost />);
    press('Next');
    press('Next');
    expect(deck.setPresentingAt.mock.calls.map(([n]): unknown => n)).toEqual([4, 4]);
  });

  it('takes a jump as given, and steps from it after', () => {
    render(<PresentationHost />);
    press('Next');
    press('Jump to 4');
    press('Back');
    expect(deck.setPresentingAt.mock.calls.map(([n]): unknown => n)).toEqual([1, 3, 2]);
  });

  it('steps from the slide on screen again once it catches up', () => {
    const view = render(<PresentationHost />);
    press('Next');
    deck.presentingAt = 1;
    view.rerender(<PresentationHost />);
    deck.presentingAt = 2;
    view.rerender(<PresentationHost />);
    press('Next');
    expect(deck.setPresentingAt).toHaveBeenLastCalledWith(3);
  });

  // The overlay holds the deck's keys: once its code is in, it draws in the very commit the first slide
  // does, never a frame later through the lazy wrapper.
  it('draws the loaded overlay in the first commit of a deck', () => {
    const view = render(<PresentationHost />);
    expect(screen.getByTestId('presentation-overlay')).toBeTruthy();
    deck.presentingAt = null;
    view.rerender(<PresentationHost />);
    expect(screen.queryByTestId('presentation-overlay')).toBeNull();
    expect(root.hasAttribute('data-presenting')).toBe(false);
  });
});
