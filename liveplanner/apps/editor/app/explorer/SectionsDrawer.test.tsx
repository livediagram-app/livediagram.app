// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionsDrawer } from './SectionsDrawer';

// docs/specs/013-workspace/explorer-structure.md: the phone's Sections drawer is a modal like any other.
describe('the Sections drawer', () => {
  it('is a labelled modal dialog that takes the focus', () => {
    render(
      <SectionsDrawer onClose={vi.fn()}>
        <a href="/explorer/home">Home</a>
      </SectionsDrawer>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Sections' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape, on its Close button and on the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SectionsDrawer onClose={onClose}>
        <span>Tree</span>
      </SectionsDrawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(container.querySelector('[aria-hidden]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
