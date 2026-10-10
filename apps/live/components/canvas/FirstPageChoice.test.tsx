// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirstPageChoice } from './FirstPageChoice';

// docs/specs/007-editor/illustrate-pages.md "Page kinds": the first page's own choice.
afterEach(() => cleanup());

describe('FirstPageChoice', () => {
  it('moves between the four cards with the arrow keys, as the Add a Page popover does', () => {
    const onChoose = vi.fn();
    render(<FirstPageChoice zoom={1} onChoose={onChoose} />);
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(4);
    cards[0]!.focus();
    fireEvent.keyDown(cards[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cards[1]);
    fireEvent.keyDown(cards[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cards[3]);
    fireEvent.keyDown(cards[3]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cards[0]);
    fireEvent.click(cards[2]!);
    expect(onChoose).toHaveBeenCalledWith('slide');
  });
});
