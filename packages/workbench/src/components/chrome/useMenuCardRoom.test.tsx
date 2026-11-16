// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useMenuCardRoom } from './useMenuCardRoom';

// docs/specs/007-editor/toolbar-layout.md "The tab's name": the menu box never runs under the strip (Work Tracker 1038).

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function mountStrip(rect: DOMRect) {
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  const card = document.createElement('div');
  card.setAttribute('data-tour-id', 'palette');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(rect);
  root.append(card);
  document.body.append(root);
}

function Probe({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const room = useMenuCardRoom(ref, enabled);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el) el.getBoundingClientRect = () => new DOMRect(12, 12, 400, 46);
      }}
      data-testid="card"
    >
      {room === null ? 'none' : room}
    </div>
  );
}

describe('useMenuCardRoom', () => {
  it('is the room left of a strip in the card’s row, less the strip’s gap', () => {
    // A crowded strip at the right of a 768px window: 768 - 12 - 425.
    mountStrip(new DOMRect(331, 12, 425, 46));
    render(<Probe />);
    expect(screen.getByTestId('card').textContent).toBe(String(331 - 8 - 12));
  });

  it('caps nothing with no strip, a strip below the card, or switched off', () => {
    render(<Probe />);
    expect(screen.getByTestId('card').textContent).toBe('none');
    cleanup();
    mountStrip(new DOMRect(331, 80, 425, 46));
    render(<Probe />);
    expect(screen.getByTestId('card').textContent).toBe('none');
    cleanup();
    document.body.innerHTML = '';
    mountStrip(new DOMRect(331, 12, 425, 46));
    render(<Probe enabled={false} />);
    expect(screen.getByTestId('card').textContent).toBe('none');
  });

  it('follows the strip as it moves, the card staying put', () => {
    mountStrip(new DOMRect(331, 12, 425, 46));
    render(<Probe />);
    const strip = document.querySelector<HTMLElement>('[data-tour-id="palette"]')!;
    vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue(new DOMRect(500, 12, 425, 46));
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('card').textContent).toBe(String(500 - 8 - 12));
  });

  it('is never negative', () => {
    mountStrip(new DOMRect(10, 12, 425, 46));
    render(<Probe />);
    expect(screen.getByTestId('card').textContent).toBe('0');
  });
});
