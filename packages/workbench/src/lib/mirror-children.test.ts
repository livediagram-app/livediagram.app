// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { mirrorChildren } from './mirror-children';

const html = (markup: string): HTMLDivElement => {
  const div = document.createElement('div');
  div.innerHTML = markup;
  return div;
};

describe('mirrorChildren', () => {
  it('copies a source into an empty target', () => {
    const target = document.createElement('div');
    mirrorChildren(target, html('<span style="color: red">Hi</span><br data-x="">'));
    expect(target.innerHTML).toBe('<span style="color: red">Hi</span><br data-x="">');
  });

  it('edits a changed text in place, replacing only its changed middle', () => {
    const source = html('<span data-rt-bold="true">Hello world</span>');
    const target = document.createElement('div');
    mirrorChildren(target, source);
    const text = target.firstChild!.firstChild as Text;
    const replace = vi.spyOn(text, 'replaceData');
    (source.firstChild!.firstChild as Text).data = 'Hello brave world';
    mirrorChildren(target, source);
    expect(target.firstChild!.firstChild).toBe(text);
    expect(text.data).toBe('Hello brave world');
    expect(replace).toHaveBeenCalledWith(6, 0, 'brave ');
  });

  it('follows a deletion and an end edit', () => {
    const source = html('abcdef');
    const target = document.createElement('div');
    mirrorChildren(target, source);
    (source.firstChild as Text).data = 'abef';
    mirrorChildren(target, source);
    expect(target.textContent).toBe('abef');
    (source.firstChild as Text).data = 'abefg';
    mirrorChildren(target, source);
    expect(target.textContent).toBe('abefg');
    mirrorChildren(target, source);
    expect(target.textContent).toBe('abefg');
  });

  it('replaces the children when the nodes differ', () => {
    const target = document.createElement('div');
    mirrorChildren(target, html('<span>a</span>'));
    const was = target.firstChild;
    for (const markup of [
      '<span>a</span><span>b</span>',
      '<b>a</b>',
      '<span data-rt-bold="true">a</span>',
      '<span data-rt-bold="false">a</span>',
      '<span><i>a</i></span>',
      'a',
      '<!--a-->',
    ]) {
      mirrorChildren(target, html(markup));
      expect(target.innerHTML).toBe(markup);
    }
    expect(target.firstChild).not.toBe(was);
    // A text where the target holds an element is a different node too.
    mirrorChildren(target, html('<span>a</span>'));
    mirrorChildren(target, html('a'));
    expect(target.innerHTML).toBe('a');
  });

  it('keeps a keystroke into 100,000 characters inside its budget', () => {
    const source = html(`<span>${'lorem ipsum '.repeat(9000)}</span>`);
    const text = source.firstChild!.firstChild as Text;
    const target = document.createElement('div');
    mirrorChildren(target, source);
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      best = Math.min(
        best,
        cpuMsOf(() => {
          text.appendData('x');
          mirrorChildren(target, source);
        }),
      );
    }
    expect(target.textContent).toBe(source.textContent);
    expect(best).toBeLessThan(cpuBudgetMs(5));
  });
});
