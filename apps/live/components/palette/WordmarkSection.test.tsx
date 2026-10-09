// @vitest-environment jsdom

// The Wordmark section (docs/specs/007-editor/logo-pages.md "Wordmark type"): tiles commit on a
// press, sliders preview as they move and commit once when let go.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TextElement } from '@livediagram/document';
import { WordmarkSection } from './WordmarkSection';

const text = (over: Partial<TextElement> = {}): TextElement => ({
  id: 't1',
  type: 'text',
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  label: 'Brand',
  ...over,
});

afterEach(() => cleanup());

function renderSection(el: TextElement) {
  const onSet = vi.fn();
  const onPreview = vi.fn();
  const onPreviewEnd = vi.fn();
  render(
    <WordmarkSection
      element={el}
      section={{ open: true, onToggle: vi.fn() }}
      onSet={onSet}
      onPreview={onPreview}
      onPreviewEnd={onPreviewEnd}
    />,
  );
  return { onSet, onPreview, onPreviewEnd };
}

describe('WordmarkSection', () => {
  it('shows the weight the text paints in, bold as Bold', () => {
    renderSection(text({ textBold: true }));
    expect(screen.getByRole('button', { name: /Bold/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('commits a weight and a case on a press', () => {
    const { onSet } = renderSection(text());
    fireEvent.click(screen.getByRole('button', { name: /Medium/ }));
    expect(onSet).toHaveBeenLastCalledWith({ fontWeight: 500 });
    fireEvent.click(screen.getByRole('button', { name: /Capitals/ }));
    expect(onSet).toHaveBeenLastCalledWith({ textCase: 'upper' });
    fireEvent.click(screen.getByRole('button', { name: /As Typed/ }));
    expect(onSet).toHaveBeenLastCalledWith({ textCase: null });
  });

  it('previews tracking while it moves and commits once when let go', () => {
    const { onSet, onPreview } = renderSection(text());
    const slider = screen.getByRole('slider', { name: 'Tracking' });
    fireEvent.change(slider, { target: { value: '20' } });
    fireEvent.change(slider, { target: { value: '25' } });
    expect(onPreview).toHaveBeenLastCalledWith({ letterSpacing: 0.25 });
    expect(onSet).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onSet).toHaveBeenCalledTimes(1);
    expect(onSet).toHaveBeenLastCalledWith({ letterSpacing: 0.25 });
  });

  it('clears tracking let go at zero, and names the arc in degrees', () => {
    const { onSet } = renderSection(text({ letterSpacing: 0.1, textArc: 90 }));
    const tracking = screen.getByRole('slider', { name: 'Tracking' });
    fireEvent.change(tracking, { target: { value: '0' } });
    fireEvent.keyUp(tracking);
    expect(onSet).toHaveBeenLastCalledWith({ letterSpacing: null });
    expect(screen.getByRole('slider', { name: 'Arc' }).getAttribute('aria-valuetext')).toBe(
      '90 degrees',
    );
  });

  it('offers Flat to straighten an arched text', () => {
    const { onSet } = renderSection(text({ textArc: -120 }));
    fireEvent.click(screen.getByRole('button', { name: 'Flat' }));
    expect(onSet).toHaveBeenLastCalledWith({ textArc: null });
  });

  it('commits nothing when let go where it started', () => {
    const { onSet } = renderSection(text());
    fireEvent.pointerUp(screen.getByRole('slider', { name: 'Arc' }));
    expect(onSet).not.toHaveBeenCalled();
  });

  it('ends the preview of a drag brought back to where it began', () => {
    const { onSet, onPreviewEnd } = renderSection(text());
    const slider = screen.getByRole('slider', { name: 'Tracking' });
    fireEvent.change(slider, { target: { value: '20' } });
    fireEvent.change(slider, { target: { value: '0' } });
    fireEvent.pointerUp(slider);
    expect(onSet).not.toHaveBeenCalled();
    expect(onPreviewEnd).toHaveBeenCalled();
  });

  it('commits a drag whose preview already wrote the live element', () => {
    const onSet = vi.fn();
    const onPreview = vi.fn();
    const props = (el: TextElement) => ({
      element: el,
      section: { open: true, onToggle: vi.fn() },
      onSet,
      onPreview,
      onPreviewEnd: vi.fn(),
    });
    const { rerender } = render(<WordmarkSection {...props(text())} />);
    const slider = screen.getByRole('slider', { name: 'Tracking' });
    fireEvent.change(slider, { target: { value: '30' } });
    // The preview has ticked the live tab: the element now carries the dragged value.
    rerender(<WordmarkSection {...props(text({ letterSpacing: 0.3 }))} />);
    fireEvent.pointerUp(screen.getByRole('slider', { name: 'Tracking' }));
    expect(onSet).toHaveBeenCalledWith({ letterSpacing: 0.3 });
  });
});
