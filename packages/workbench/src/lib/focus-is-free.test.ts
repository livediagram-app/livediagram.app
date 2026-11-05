// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { focusIsFree } from './focus-is-free';

// docs/specs/007-editor/start-diagramming.md "Keyboard": a late start panel takes focus only from the page or the canvas.
describe('focusIsFree', () => {
  afterEach(() => document.body.replaceChildren());

  it('is free on the page itself', () => {
    expect(document.activeElement).toBe(document.body);
    expect(focusIsFree()).toBe(true);
  });

  it('is free on the canvas', () => {
    const canvas = document.createElement('main');
    canvas.setAttribute('data-canvas-root', '');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();
    expect(focusIsFree()).toBe(true);
  });

  it('is taken by a control the person reached', () => {
    const control = document.createElement('button');
    document.body.append(control);
    control.focus();
    expect(focusIsFree()).toBe(false);
  });

  it('is free with no focused element at all', () => {
    const empty = document.implementation.createHTMLDocument('');
    empty.documentElement.replaceChildren();
    expect(empty.activeElement).toBeNull();
    expect(focusIsFree(empty)).toBe(true);
  });
});
