// livedesign/docs/specs/007-editor/logo-pages.md "Outlined text": the sentences the Logo Kit shows when it can't outline.
import { describe, expect, it } from 'vitest';
import { OutlineError } from './outline-error';

describe('OutlineError', () => {
  it('names the face it could not fetch', () => {
    const e = new OutlineError('font', 'Lobster');
    expect(e).toBeInstanceOf(Error);
    expect(e).toMatchObject({ name: 'OutlineError', kind: 'font', face: 'Lobster' });
    expect(e.message).toBe(
      "Couldn't fetch Lobster, so the logo's text can't be outlined. Check your connection and try again.",
    );
  });

  it('names the letters a face lacks', () => {
    expect(new OutlineError('letters', 'Lobster', '字').message).toBe(
      "The letters “字” aren't in Lobster's Latin set, so they can't be outlined.",
    );
  });

  it('says to try again when the layout could not be read', () => {
    expect(new OutlineError('layout', 'Inter').message).toBe(
      "The logo's text couldn't be outlined. Try again.",
    );
  });
});
