// @vitest-environment jsdom

// A reader selects and copies the writing (docs/specs/030-knowledgebase/editing.md "Selecting and copying").
// The root cause it guards: read, the writing is contenteditable="false", so the canvas's selectstart guard
// cancelled every selection on it, and the canvas's select-none cascaded into it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cancelsCanvasSelectStart } from '@liveworkspace/workbench/hooks/canvas/useNoCanvasTextSelection';
import { articleFlowClass } from './read-mode-selection';

afterEach(() => {
  document.body.innerHTML = '';
});

function flow(editable: boolean) {
  document.body.innerHTML = `<main class="select-none"><div class="${articleFlowClass(editable)}" contenteditable="${editable}"><p>Some words</p></div><div id="margin"></div></main>`;
  const p = document.querySelector('p')!;
  return { text: p.firstChild!, margin: document.getElementById('margin')! };
}

describe('selecting the writing in read mode', () => {
  it('lets a selection start on the read writing, and still cancels one on the canvas round it', () => {
    const { text, margin } = flow(false);
    expect(cancelsCanvasSelectStart(text)).toBe(false);
    expect(cancelsCanvasSelectStart(margin)).toBe(true);
  });

  it('opts in only while read: editing, the writing is contenteditable and passes the guard as it is', () => {
    expect(articleFlowClass(true)).toBe('article-flow');
    expect(articleFlowClass(false).split(' ')).toContain('select-text');
    const { text } = flow(true);
    expect(cancelsCanvasSelectStart(text)).toBe(false);
  });

  it('makes the read writing selectable over the select-none canvas, and keeps the page slots out', () => {
    const css = readFileSync(join(__dirname, '../../../app/article-pages.css'), 'utf8');
    const rule = css.match(/\.article-flow\[data-readonly\] \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/(^|\s)user-select: text;/);
    expect(rule).toMatch(/-webkit-user-select: text;/);
    const slot = css.match(/\.article-flow \.article-page-slot \{([^}]*)\}/)?.[1] ?? '';
    expect(slot).toMatch(/user-select: none;/);
  });
});
