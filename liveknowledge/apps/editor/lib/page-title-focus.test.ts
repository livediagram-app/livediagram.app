// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearTitleFocus,
  focusMovedSince,
  newKnowledgebaseTakesCaret,
  takeTitleFocus,
  wantTitleFocus,
} from './page-title-focus';

afterEach(clearTitleFocus);

describe('the Title focus ask', () => {
  it('is spent by its answer, and answers only the page asked for', () => {
    wantTitleFocus('a');
    expect(takeTitleFocus('b')).toBeNull();
    expect(takeTitleFocus('a')).toEqual({ from: document.body });
    expect(takeTitleFocus('a')).toBeNull();
  });

  it('keeps what had focus when the page was asked for', () => {
    const made = document.createElement('button');
    document.body.append(made);
    made.focus();
    wantTitleFocus('a');
    document.body.focus();
    expect(takeTitleFocus('a')).toEqual({ from: made });
    made.remove();
  });

  it("keeps a menu's trigger, not its item, when the page was asked for from a menu", () => {
    const trigger = document.createElement('button');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', 'row-menu');
    const menu = document.createElement('div');
    menu.id = 'row-menu';
    menu.setAttribute('role', 'menu');
    const item = document.createElement('button');
    item.setAttribute('role', 'menuitem');
    menu.append(item);
    document.body.append(trigger, menu);
    item.focus();
    wantTitleFocus('a');
    // The menu closes and hands focus back to its trigger: the Title may still take the caret.
    menu.remove();
    trigger.focus();
    const ask = takeTitleFocus('a');
    expect(ask).toEqual({ from: trigger });
    expect(focusMovedSince(ask!.from)).toBe(false);
    trigger.remove();
  });

  it('keeps the item itself when its menu names no trigger', () => {
    const menu = document.createElement('div');
    menu.id = 'lone-menu';
    menu.setAttribute('role', 'menu');
    const item = document.createElement('button');
    menu.append(item);
    document.body.append(menu);
    item.focus();
    wantTitleFocus('a');
    expect(takeTitleFocus('a')).toEqual({ from: item });
    menu.remove();
  });
});

// A late caret never takes focus the person has moved (docs/specs/030-knowledgebase/editing.md "Edit mode").
describe('focusMovedSince', () => {
  afterEach(() => document.body.replaceChildren());
  const focusable = (tag: string, parent: Element = document.body) => {
    const el = document.createElement(tag);
    el.tabIndex = 0;
    parent.append(el);
    return el;
  };

  it('is false while focus is on nothing, or still on what had it when the page was asked for', () => {
    expect(focusMovedSince(null)).toBe(false);
    const made = focusable('button');
    made.focus();
    expect(focusMovedSince(made)).toBe(false);
  });

  it('is false on the canvas surface the editor opens on, and in the writing', () => {
    const canvas = focusable('main');
    canvas.setAttribute('data-canvas-a11y-root', '');
    canvas.focus();
    expect(focusMovedSince(null)).toBe(false);
    const writing = focusable('div', canvas);
    writing.className = 'ProseMirror';
    writing.focus();
    expect(focusMovedSince(null)).toBe(false);
  });

  it('is true once the person has moved focus to a control of their own, like a menu button', () => {
    const made = focusable('button');
    const menu = focusable('button');
    made.focus();
    menu.focus();
    expect(focusMovedSince(made)).toBe(true);
    expect(focusMovedSince(null)).toBe(true);
  });

  it('is true for a menu button in a panel the canvas holds (the sidebar floats inside it)', () => {
    const canvas = focusable('main');
    canvas.setAttribute('data-canvas-a11y-root', '');
    const menu = focusable('button', canvas);
    menu.focus();
    expect(focusMovedSince(null)).toBe(true);
  });
});

describe('newKnowledgebaseTakesCaret', () => {
  it('is true for no template and for a blank one, which /new?blank=1 names', () => {
    expect(newKnowledgebaseTakesCaret(null)).toBe(true);
    expect(newKnowledgebaseTakesCaret('blank')).toBe(true);
  });

  it('is false for a template that brings its own writing', () => {
    expect(newKnowledgebaseTakesCaret('article')).toBe(false);
  });
});
