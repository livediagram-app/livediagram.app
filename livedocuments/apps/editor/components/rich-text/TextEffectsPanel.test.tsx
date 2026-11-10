// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextEffectsButton, TextEffectsPanel } from './TextEffectsPanel';

// docs/specs/008-canvas/text-effects.md "The Text Effects panel": a pick applies at once and closes the panel.
describe('Text Effects', () => {
  it('opens from the toolbar, applies a gradient and closes', () => {
    const onApply = vi.fn();
    render(<TextEffectsButton highlight={null} gradient={null} onApply={onApply} />);
    const trigger = screen.getByRole('button', { name: 'Text Effects' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Ocean gradient' }));
    expect(onApply).toHaveBeenCalledWith({ gradient: 'ocean' });
    expect(screen.queryByRole('button', { name: 'Ocean gradient' })).toBeNull();
  });

  it('marks the current gradient, and clears it with No Gradient', () => {
    const onApply = vi.fn();
    render(<TextEffectsPanel highlight={null} gradient="berry" onApply={onApply} />);
    expect(
      screen.getByRole('button', { name: 'Berry gradient' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: 'No gradient' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'No gradient' }));
    expect(onApply).toHaveBeenCalledWith({ gradient: undefined });
  });

  it('clears a highlight with No Highlight', () => {
    const onApply = vi.fn();
    render(<TextEffectsPanel highlight="#fde68a" gradient={null} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /No Highlight/ }));
    expect(onApply).toHaveBeenCalledWith({ highlight: undefined });
  });
});
