// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { capInsertion, fitInsertion } from './text-cap';

// docs/specs/009-elements/badge.md "The element": the editor stops taking text at a badge's or step's cap.
describe('capInsertion', () => {
  it('lets everything through with no cap', () => {
    expect(capInsertion('hello', 100, 0, undefined)).toBe('hello');
  });

  it('cuts an insertion to the room left, and takes nothing once full', () => {
    expect(capInsertion('abcd', 1, 0, 3)).toBe('ab');
    expect(capInsertion('a', 3, 0, 3)).toBe('');
    expect(capInsertion('ab', 1, 0, 3)).toBe('ab');
  });

  it('counts the selection it replaces as room', () => {
    expect(capInsertion('xy', 3, 2, 3)).toBe('xy');
    expect(capInsertion('xyz', 3, 1, 3)).toBe('x');
  });

  it('never splits an emoji: one that does not fit whole is left out', () => {
    expect(capInsertion('a\u{1F600}', 1, 0, 3)).toBe('a');
    expect(capInsertion('\u{1F600}', 2, 0, 3)).toBe('');
    expect(capInsertion('\u{1F600}b', 1, 0, 3)).toBe('\u{1F600}');
  });

  it('stays cheap on a long paste', () => {
    const long = 'x'.repeat(1_000_000);
    expect(capInsertion(long, 10, 0, 24)).toHaveLength(14);
    // Each call slices only what fits (about 20 ns measured); a thousand stay far inside one keystroke's budget.
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++) capInsertion(long, 10, 0, 24);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('fitInsertion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  function editor(text: string): HTMLElement {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    el.textContent = text;
    document.body.append(el);
    return el;
  }

  it('passes text through with no cap or no editor', () => {
    expect(fitInsertion(editor('123'), 'abc', undefined)).toBe('abc');
    expect(fitInsertion(null, 'abc', 3)).toBe('abc');
  });

  it('cuts to the room the editor’s text leaves', () => {
    expect(fitInsertion(editor('1'), '2345', 3)).toBe('23');
    expect(fitInsertion(editor('123'), '4', 3)).toBe('');
  });

  it('counts a selection inside the editor as room, and ignores one outside it', () => {
    const el = editor('123');
    const range = document.createRange();
    range.setStart(el.firstChild!, 1);
    range.setEnd(el.firstChild!, 3);
    window.getSelection()!.addRange(range);
    expect(fitInsertion(el, '456', 3)).toBe('45');
    const other = editor('elsewhere');
    window.getSelection()!.removeAllRanges();
    const outside = document.createRange();
    outside.selectNodeContents(other);
    window.getSelection()!.addRange(outside);
    expect(fitInsertion(el, '4', 3)).toBe('');
  });
});
