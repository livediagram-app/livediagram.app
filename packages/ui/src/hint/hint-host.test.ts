// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hintHost } from './HintSurface';

// Work Tracker 1109: where a hint draws, the trigger's own document and window.
describe('hintHost', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is the page for a trigger in the page, or none known yet', () => {
    const el = document.body.appendChild(document.createElement('button'));
    expect(hintHost(el)).toEqual({ doc: document, win: window });
    expect(hintHost(null)).toEqual({ doc: document, win: window });
    el.remove();
  });

  it('is the other document for a trigger in one, with the page’s window when it has none of its own', () => {
    const other = document.implementation.createHTMLDocument('other');
    const el = other.body.appendChild(other.createElement('button'));
    const host = hintHost(el);
    expect(host?.doc).toBe(other);
    expect(host?.win).toBe(window);
  });

  it('is nothing outside a browser', () => {
    vi.stubGlobal('document', undefined);
    expect(hintHost(null)).toBeNull();
  });
});
