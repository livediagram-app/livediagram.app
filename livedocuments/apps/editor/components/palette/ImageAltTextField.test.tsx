// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_ALT_MAX } from '@livedocuments/document';
import { IMAGE_ALT_WARN_LEFT, ImageAltTextField } from './ImageAltTextField';

// docs/specs/009-elements/images.md "Alt text": a draft while typing, written on Enter, on leaving the field and when
// the menu closes with it changed; Escape puts the stored words back; read-only words without a writer.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Alt Text' });

describe('ImageAltTextField', () => {
  it('shows the stored words under a labelled, described field', () => {
    render(<ImageAltTextField value="A cat" onCommit={vi.fn()} />);
    expect(field().value).toBe('A cat');
    expect(field().maxLength).toBe(IMAGE_ALT_MAX);
    expect(field().getAttribute('placeholder')).toBe('Describe the picture');
    const described = field().getAttribute('aria-describedby')!.split(' ');
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Describes the picture for screen readers and exports.',
      `5 / ${IMAGE_ALT_MAX}`,
    ]);
  });

  it('writes the draft on Enter, once, without breaking the line', () => {
    const onCommit = vi.fn();
    render(<ImageAltTextField value="photo.jpg" onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: 'A red bicycle' } });
    expect(onCommit).not.toHaveBeenCalled();
    const enter = fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });
    expect(enter).toBe(false);
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('A red bicycle');
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it('writes on leaving the field, and nothing when the words did not change', () => {
    const onCommit = vi.fn();
    render(<ImageAltTextField value="A cat" onCommit={onCommit} />);
    fireEvent.blur(field());
    fireEvent.change(field(), { target: { value: 'A cat' } });
    fireEvent.blur(field());
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: 'A black cat' } });
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('A black cat');
  });

  it('flashes Saved only when the cleaned words changed, and lets it go', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<ImageAltTextField value="A cat" onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: '  A cat ' } });
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('');
    fireEvent.change(field(), { target: { value: 'A dog' } });
    fireEvent.blur(field());
    expect(screen.getByRole('status').textContent).toBe('Saved');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('puts the stored words back on Escape, writes nothing, and keeps the menu open', () => {
    const onCommit = vi.fn();
    render(<ImageAltTextField value="A cat" onCommit={onCommit} />);
    field().focus();
    fireEvent.change(field(), { target: { value: 'Oops' } });
    const escape = fireEvent.keyDown(field(), { key: 'Escape' });
    // Claimed (default prevented), so useControlMenu leaves the menu open.
    expect(escape).toBe(false);
    expect(field().value).toBe('A cat');
    expect(document.activeElement).not.toBe(field());
    expect(onCommit).not.toHaveBeenCalled();
    // Other keys type as usual.
    expect(fireEvent.keyDown(field(), { key: 'a' })).toBe(true);
  });

  it('writes a changed draft when the menu closes under it', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<ImageAltTextField value="A cat" onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: 'A sleeping cat' } });
    unmount();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('A sleeping cat');
  });

  it('writes nothing on close when the draft was already written or never changed', () => {
    const onCommit = vi.fn();
    const first = render(<ImageAltTextField value="A cat" onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: 'A dog' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    first.unmount();
    expect(onCommit).toHaveBeenCalledOnce();
    const second = render(<ImageAltTextField value={undefined} onCommit={onCommit} />);
    second.unmount();
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('follows the stored words from another client while not being typed in', () => {
    const { rerender } = render(<ImageAltTextField value="A cat" onCommit={vi.fn()} />);
    rerender(<ImageAltTextField value="A cat on a mat" onCommit={vi.fn()} />);
    expect(field().value).toBe('A cat on a mat');
  });

  it(`turns the count amber and speaks it within ${IMAGE_ALT_WARN_LEFT} of the cap`, () => {
    render(<ImageAltTextField value={undefined} onCommit={vi.fn()} />);
    expect(field().value).toBe('');
    const count = () =>
      document.getElementById(field().getAttribute('aria-describedby')!.split(' ')[1]!)!;
    const live = () => document.querySelector('[aria-live="polite"]')!;
    expect(count().className).not.toContain('amber');
    expect(live().textContent).toBe('');
    fireEvent.change(field(), { target: { value: 'a'.repeat(IMAGE_ALT_MAX - 5) } });
    expect(count().className).toContain('amber');
    expect(count().textContent).toBe(`${IMAGE_ALT_MAX - 5} / ${IMAGE_ALT_MAX}`);
    expect(live().textContent).toBe('5 characters left');
  });

  it('only reads the words without a writer (a Viewer)', () => {
    const { rerender } = render(<ImageAltTextField value="A red bicycle" />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Alt Text')).toBeTruthy();
    expect(screen.getByText('A red bicycle')).toBeTruthy();
    rerender(<ImageAltTextField value={undefined} />);
    expect(screen.getByText('Not described yet')).toBeTruthy();
  });
});
