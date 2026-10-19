// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirstPageChoice } from './FirstPageChoice';

// docs/specs/007-editor/pages-mode.md "Page kinds": the first page's own choice.
afterEach(() => cleanup());

describe('FirstPageChoice', () => {
  it('moves between the five cards with the arrow keys, as the Add a Page popover does', () => {
    const onChoose = vi.fn();
    render(<FirstPageChoice zoom={1} onChoose={onChoose} />);
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(5);
    cards[0]!.focus();
    fireEvent.keyDown(cards[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cards[1]);
    fireEvent.keyDown(cards[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cards[3]);
    fireEvent.keyDown(cards[3]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cards[4]);
    fireEvent.keyDown(cards[4]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cards[0]);
    fireEvent.click(cards[2]!);
    expect(onChoose).toHaveBeenCalledWith('slide');
  });

  it('turns to Choose a Device for a wireframe, and back', () => {
    // docs/specs/007-editor/wireframe-pages.md "Choosing the device".
    const onChoose = vi.fn();
    render(<FirstPageChoice zoom={1} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole('button', { name: /Wireframe/ }));
    expect(screen.getByText('Choose a Device')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByText('What Is This Page For?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Wireframe/ }));
    fireEvent.click(document.querySelector('[data-device-tile="android"]')!);
    expect(onChoose).toHaveBeenCalledWith('wireframe', 'android');
  });
});
