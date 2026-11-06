// @vitest-environment jsdom
// An empty page's invite to start from a layout (livedocuments' Use a Layout, livedesign's Choose a Layout).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyPageInvite } from './EmptyPageInvite';

afterEach(() => cleanup());

describe('EmptyPageInvite', () => {
  it('names itself, says what it starts from, and opens on a press', () => {
    const onOpen = vi.fn();
    render(<EmptyPageInvite pageId="p" zoom={1} label="Use a Layout" onOpen={onOpen} />);
    const button = screen.getByRole('button', { name: 'Use a Layout' });
    expect(button.textContent).toContain('Start from a ready-made page');
    expect(button.getAttribute('data-empty-page-invite')).toBe('p');
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('keeps its screen size at any zoom, its counter-scale on a wrapper so its own motion stays free', () => {
    render(<EmptyPageInvite pageId="p" zoom={0.5} onOpen={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Choose a Layout' });
    expect(button.style.transform).toBe('');
    expect((button.parentElement as HTMLElement).style.transform).toBe('scale(2)');
  });

  it('keeps a press on it from reaching the canvas', () => {
    const onCanvas = vi.fn();
    render(
      <div onPointerDown={onCanvas} onDoubleClick={onCanvas}>
        <EmptyPageInvite pageId="p" zoom={1} onOpen={vi.fn()} />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Choose a Layout' });
    fireEvent.pointerDown(button);
    fireEvent.doubleClick(button);
    expect(onCanvas).not.toHaveBeenCalled();
  });
});
