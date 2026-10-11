// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRESENTATION_CONFIG } from '@/lib/presentation-config';
import { loadPresentationOverlay } from '@/lib/editor-deferred-code';
import { PresentationHost } from './PresentationHost';

// docs/specs/012-collaboration/presentation-mode.md: the slide transition's class lives exactly as long as the
// canvas surface's own animation.
const deck = {
  presentingAt: 0 as number | null,
  runnable: [{ slide: { id: 's1' } }, { slide: { id: 's2' } }],
  config: DEFAULT_PRESENTATION_CONFIG,
  setPresentingAt: vi.fn(),
  exitPresentation: vi.fn(),
  updateConfig: vi.fn(),
};
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ({ slideDeck: deck, canvasTool: 'select', setCanvasTool: vi.fn() }),
}));
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));
vi.mock('@/components/canvas/CanvasSurfaceContext', () => ({ useCanvasSurface: () => 'light' }));
vi.mock('@/components/plan/plan-palette', () => ({ planPalette: () => ({}) }));
vi.mock('@/components/canvas/PresentationOverlay', () => ({
  PresentationOverlay: () => <div data-testid="presentation-overlay" />,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('PresentationHost', () => {
  it("clears the slide move on the surface's own animationend, not one bubbling from inside it", () => {
    const surface = document.createElement('div');
    surface.setAttribute('data-canvas-a11y-root', '');
    const note = document.createElement('div');
    surface.appendChild(note);
    document.body.appendChild(surface);
    const root = document.documentElement;
    render(<PresentationHost />);
    expect(root.getAttribute('data-slide-move')).toBe('in');
    act(() => {
      note.dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    expect(root.getAttribute('data-slide-move')).toBe('in');
    act(() => {
      surface.dispatchEvent(new Event('animationend', { bubbles: true }));
    });
    expect(root.hasAttribute('data-slide-move')).toBe(false);
  });

  // The overlay holds the deck's keys: once its code is in, it draws in the very commit the first slide
  // does, never a frame later through the lazy wrapper.
  it('draws the loaded overlay in the first commit of a deck', async () => {
    await loadPresentationOverlay();
    const view = render(<PresentationHost />);
    expect(screen.getByTestId('presentation-overlay')).toBeTruthy();
    deck.presentingAt = null;
    view.rerender(<PresentationHost />);
    expect(screen.queryByTestId('presentation-overlay')).toBeNull();
    deck.presentingAt = 0;
  });
});
