// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { focusIsPlaced, placeFocus } from './focus-origin';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focus-origin', () => {
  it('says focus is placed only while placeFocus moves it', () => {
    const button = document.createElement('button');
    document.body.append(button);
    const seen: boolean[] = [];
    button.addEventListener('focus', () => seen.push(focusIsPlaced()));
    expect(focusIsPlaced()).toBe(false);
    placeFocus(button, { preventScroll: true });
    expect(document.activeElement).toBe(button);
    expect(seen).toEqual([true]);
    expect(focusIsPlaced()).toBe(false);
    button.blur();
    button.focus();
    expect(seen).toEqual([true, false]);
  });

  it('is over even when focusing throws', () => {
    const broken = {
      focus: () => {
        throw new Error('gone');
      },
    } as unknown as HTMLElement;
    expect(() => placeFocus(broken)).toThrow('gone');
    expect(focusIsPlaced()).toBe(false);
  });
});
