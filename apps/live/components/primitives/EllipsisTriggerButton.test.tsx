// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EllipsisTriggerButton } from './EllipsisTriggerButton';

const noop = () => {};

describe('EllipsisTriggerButton', () => {
  it('announces the menu it opens and whether it is open', () => {
    render(<EllipsisTriggerButton label="Folder menu" onClick={noop} expanded />);
    const button = screen.getByRole('button', { name: 'Folder menu' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('sizes the square from the size variant, large by default', () => {
    const { rerender } = render(<EllipsisTriggerButton label="m" onClick={noop} />);
    expect(screen.getByRole('button').className).toContain('h-7 w-7');
    rerender(<EllipsisTriggerButton label="m" onClick={noop} size="sm" />);
    expect(screen.getByRole('button').className).toContain('h-5 w-5');
  });

  it('hides until hover in reveal mode, but stays pinned while its menu is open', () => {
    const { rerender } = render(<EllipsisTriggerButton label="m" onClick={noop} reveal />);
    expect(screen.getByRole('button').className).toContain('sm:opacity-0');
    rerender(<EllipsisTriggerButton label="m" onClick={noop} reveal expanded />);
    expect(screen.getByRole('button').className).not.toContain('sm:opacity-0');
  });
});
