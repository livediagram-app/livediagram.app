// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { releaseReadSelection } from './read-selection';

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

function page(readonly: boolean) {
  document.body.innerHTML = `<div data-page-scroller><div id="margin"></div><div class="article-flow" ${readonly ? 'data-readonly' : ''}><p id="words">Some words here</p></div></div><p id="elsewhere">Elsewhere</p>`;
  const words = document.getElementById('words')!;
  return {
    words,
    margin: document.getElementById('margin')!,
    elsewhere: document.getElementById('elsewhere')!,
  };
}

function select(el: Element) {
  const r = document.createRange();
  r.selectNodeContents(el);
  const s = window.getSelection()!;
  s.removeAllRanges();
  s.addRange(r);
}
const selected = () => String(window.getSelection());

describe('a reader selection lets go on a press off the writing', () => {
  it('clears a selection in the read writing on a press on the margin', () => {
    const { words, margin } = page(true);
    select(words);
    releaseReadSelection(margin);
    expect(selected()).toBe('');
  });

  it('leaves it to the browser on a press on the writing itself', () => {
    const { words } = page(true);
    select(words);
    releaseReadSelection(words);
    expect(selected()).toBe('Some words here');
  });

  it('never touches a selection elsewhere, an editing caret or nothing selected', () => {
    const { margin, elsewhere, words } = page(true);
    select(elsewhere);
    releaseReadSelection(margin);
    expect(selected()).toBe('Elsewhere');
    window.getSelection()!.removeAllRanges();
    releaseReadSelection(margin);
    expect(selected()).toBe('');
    // A text node anchor, and a press with no element target.
    select(words.firstChild as unknown as Element);
    releaseReadSelection(null);
    expect(selected()).toBe('');
    page(false);
    select(document.getElementById('words')!);
    releaseReadSelection(document.getElementById('margin'));
    expect(selected()).toBe('Some words here');
  });
});
