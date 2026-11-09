import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedocuments/document';
import { goToElement } from './go-to-element';

describe('goToElement', () => {
  it('selects the card and centres it in the view', () => {
    const card = {
      id: 'c',
      type: 'shape',
      shape: 'square',
      x: 40,
      y: 3000,
      width: 100,
      height: 60,
    };
    const select = vi.fn();
    const scroll = vi.fn();
    goToElement([card as unknown as Element], 'c', select, scroll);
    expect(select).toHaveBeenCalledWith('c');
    expect(scroll).toHaveBeenCalledWith(40, 3000, 100, 60, { center: true });
  });

  it('only selects an element it cannot find', () => {
    const scroll = vi.fn();
    goToElement([], 'gone', vi.fn(), scroll);
    expect(scroll).not.toHaveBeenCalled();
  });
});
