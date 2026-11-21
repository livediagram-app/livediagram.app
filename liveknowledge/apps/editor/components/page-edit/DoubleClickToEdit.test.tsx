// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DoubleClickToEdit, HINT_DELAY_MS, overWriting } from './DoubleClickToEdit';

const page = () => {
  document.body.innerHTML = `<div data-canvas-root><div id="margin">margin</div><div class="article-flow" data-readonly><p id="words">Some words <a id="link" href="#x">a link</a></p></div></div><p id="outside">Elsewhere</p>`;
  return {
    words: document.getElementById('words')!,
    link: document.getElementById('link')!,
    outside: document.getElementById('outside')!,
  };
};
const hint = () => document.querySelector('[data-double-click-hint]');
const move = (target: Element, x = 100, y = 120) =>
  fireEvent.pointerMove(target, { pointerType: 'mouse', buttons: 0, clientX: x, clientY: y });

describe('Double-click to Edit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts the writing, never a link, a control or outside the page', () => {
    const { words, link, outside } = page();
    expect(overWriting(words)).toBe(true);
    // Anywhere over the page being read, its margins too.
    expect(overWriting(document.getElementById('margin'))).toBe(true);
    expect(overWriting(link)).toBe(false);
    expect(overWriting(outside)).toBe(false);
    expect(overWriting(null)).toBe(false);
  });

  it('shows the label under the pointer after a rest, and hides it over a link and on a press', () => {
    const { words, link } = page();
    render(<DoubleClickToEdit active onEdit={vi.fn()} />);
    move(words);
    expect(hint()!.hasAttribute('data-shown')).toBe(false);
    void act(() => vi.advanceTimersByTime(HINT_DELAY_MS));
    expect(hint()!.hasAttribute('data-shown')).toBe(true);
    expect((hint() as HTMLElement).style.transform).toBe('translate3d(114px, 140px, 0px)');
    move(link);
    expect(hint()!.hasAttribute('data-shown')).toBe(false);
    move(words);
    void act(() => vi.advanceTimersByTime(HINT_DELAY_MS));
    fireEvent.pointerDown(words);
    expect(hint()!.hasAttribute('data-shown')).toBe(false);
  });

  it('opens edit mode on a double-click on the writing only', () => {
    const { words, outside } = page();
    const onEdit = vi.fn();
    render(<DoubleClickToEdit active onEdit={onEdit} />);
    fireEvent.doubleClick(outside);
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.doubleClick(words);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('is not there while editing, or for anyone who may not edit', () => {
    const { words } = page();
    const onEdit = vi.fn();
    render(<DoubleClickToEdit active={false} onEdit={onEdit} />);
    expect(hint()).toBeNull();
    fireEvent.doubleClick(words);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
