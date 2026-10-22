// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fitHeight } from './useAutoHeight';

// A textarea whose content needs `content` px, with 22px lines, 4px padding each side and 1px borders.
function field(content: number): HTMLTextAreaElement {
  const el = document.createElement('textarea');
  el.style.lineHeight = '22px';
  el.style.padding = '4px 8px';
  document.body.appendChild(el);
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => content + 8 });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => 32 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 30 });
  return el;
}

describe('fitHeight', () => {
  it('takes one line when short, with no scrollbar', () => {
    const el = field(22);
    fitHeight(el, { lines: 3 });
    expect(el.style.height).toBe('32px');
    expect(el.style.overflowY).toBe('hidden');
  });

  it('grows with the text up to its lines, then scrolls', () => {
    const two = field(44);
    fitHeight(two, { lines: 3 });
    expect(two.style.height).toBe('54px');
    expect(two.style.overflowY).toBe('hidden');
    const five = field(110);
    fitHeight(five, { lines: 3 });
    // 3 lines of 22px, 8px of padding and 2px of borders.
    expect(five.style.height).toBe('76px');
    expect(five.style.overflowY).toBe('auto');
  });

  it('caps at a height in px too (the comment composer)', () => {
    const el = field(400);
    fitHeight(el, { px: 160 });
    expect(el.style.height).toBe('160px');
    expect(el.style.overflowY).toBe('auto');
  });
});
