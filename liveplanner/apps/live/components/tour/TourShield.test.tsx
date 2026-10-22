// @vitest-environment jsdom
// The tour's click shield (docs/specs/007-editor/editor-tour.md "The page waits"): a press on it never reaches the page,
// not even a project listener such as an open menu's outside-press close.
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourShield } from './TourShield';

afterEach(cleanup);

describe('TourShield', () => {
  it('stops a press on the shield before any project listener sees it', () => {
    render(<TourShield />);
    const shield = document.querySelector<HTMLElement>('[data-tour-shield]')!;
    const outsidePress = vi.fn();
    document.addEventListener('pointerdown', outsidePress, true);
    document.addEventListener('click', outsidePress);
    fireEvent.pointerDown(shield);
    expect(fireEvent.click(shield)).toBe(false);
    expect(outsidePress).not.toHaveBeenCalled();
    document.removeEventListener('pointerdown', outsidePress, true);
    document.removeEventListener('click', outsidePress);
  });

  it('lets a press elsewhere through, and lets go once gone', () => {
    const { unmount } = render(<TourShield />);
    const card = document.createElement('button');
    document.body.append(card);
    const pressed = vi.fn();
    card.addEventListener('click', pressed);
    fireEvent.click(card);
    expect(pressed).toHaveBeenCalledTimes(1);
    const shield = document.querySelector<HTMLElement>('[data-tour-shield]')!;
    unmount();
    const later = vi.fn();
    document.addEventListener('click', later);
    document.body.append(shield);
    fireEvent.click(shield);
    expect(later).toHaveBeenCalledTimes(1);
    document.removeEventListener('click', later);
    card.remove();
    shield.remove();
  });

  it('shows the not-allowed cursor over the held page', () => {
    render(<TourShield />);
    expect(document.querySelector('[data-tour-shield]')?.className).toContain('cursor-not-allowed');
  });
});
