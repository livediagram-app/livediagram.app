import { describe, expect, it } from 'vitest';
import { arrowPageDir, pageStep } from './page-step';

// docs/specs/007-editor/pages-mode.md "Getting around the pages": the arrow keys between pages.
describe('pageStep', () => {
  const pages = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('goes to the next or previous page from the page someone is on', () => {
    expect(pageStep(pages, 'b', 1)).toBe('c');
    expect(pageStep(pages, 'b', -1)).toBe('a');
  });

  it('stops at either end, and starts from the first before a page is known', () => {
    expect(pageStep(pages, 'c', 1)).toBeNull();
    expect(pageStep(pages, 'a', -1)).toBeNull();
    expect(pageStep(pages, null, 1)).toBe('b');
    expect(pageStep(pages, 'gone', 1)).toBe('b');
  });

  it('reads Right and Down as forward, Left and Up as back', () => {
    expect(arrowPageDir('ArrowRight')).toBe(1);
    expect(arrowPageDir('ArrowDown')).toBe(1);
    expect(arrowPageDir('ArrowLeft')).toBe(-1);
    expect(arrowPageDir('ArrowUp')).toBe(-1);
    expect(arrowPageDir('a')).toBeNull();
  });
});
