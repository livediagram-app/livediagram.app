// @vitest-environment jsdom
// Pop Out (docs/specs/008-canvas/avatar-mode.md "The mini view"): opens the mini view and, pressed again, closes it.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeMiniView, miniViewWindow } from '@/lib/mini-view/mini-view-window';
import { fakePipWindow, installPip, removePip, type FakePipWindow } from '@/test/fake-pip-window';
import { CallNames } from './CallSegment';
import { POP_OUT_TEXT, PopOutSegment } from './PopOutSegment';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

let pip: FakePipWindow;
beforeEach(() => {
  pip = fakePipWindow();
  installPip(pip);
});
afterEach(() => {
  cleanup();
  closeMiniView();
  removePip();
  track.mockClear();
});

describe('PopOutSegment', () => {
  it('opens the mini view on a press, then reads Popped Out, pressed, until pressed again', async () => {
    render(
      <CallNames.Provider value>
        <PopOutSegment />
      </CallNames.Provider>,
    );
    const button = screen.getByRole('button', { name: POP_OUT_TEXT.closed.label });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent).toBe('Pop Out');
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(miniViewWindow()).toBe(pip);
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'SpaceMiniView');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toBe('Popped Out');
    act(() => {
      fireEvent.click(button);
    });
    expect(pip.close).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('unpresses when the person closes the window themselves', async () => {
    render(<PopOutSegment />);
    const button = screen.getByRole('button', { name: 'Pop Out' });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    act(() => pip.fire('pagehide'));
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('draws nothing where the browser cannot open one (desktop Safari, a phone)', () => {
    removePip();
    const { container } = render(<PopOutSegment />);
    expect(container.innerHTML).toBe('');
  });
});
