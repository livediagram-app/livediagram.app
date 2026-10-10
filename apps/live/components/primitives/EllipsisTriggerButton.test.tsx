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

  it('hides until hover in reveal mode only where the pointer can hover', () => {
    render(<EllipsisTriggerButton label="m" onClick={noop} reveal />);
    const classes = screen.getByRole('button').className.split(' ');
    expect(classes).toContain('pointer-fine:opacity-0');
    expect(classes).toContain('pointer-fine:group-hover:opacity-100');
    // A touch screen has no hover, so nothing hides it there.
    expect(classes).not.toContain('opacity-0');
    expect(classes.some((c) => c.startsWith('sm:'))).toBe(false);
  });

  it('shows in reveal mode while its tree row has keyboard focus', () => {
    render(<EllipsisTriggerButton label="m" onClick={noop} reveal />);
    const classes = screen.getByRole('button').className.split(' ');
    expect(classes).toContain('pointer-fine:focus-visible:opacity-100');
    expect(classes).toContain('pointer-fine:[li:focus-visible>div>&]:opacity-100');
  });

  it('stays pinned in reveal mode while its menu is open', () => {
    render(<EllipsisTriggerButton label="m" onClick={noop} reveal expanded />);
    expect(screen.getByRole('button').className).not.toContain('opacity-0');
  });
});
