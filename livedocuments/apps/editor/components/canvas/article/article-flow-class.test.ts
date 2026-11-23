// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cancelsCanvasSelectStart } from '@liveworkspace/workbench/hooks/canvas/useNoCanvasTextSelection';
import { articleFlowClass } from './article-view-mount';

// docs/specs/013-workspace/send-to-plan.md "Words in an article's writing": a reader picks words in writing they
// cannot change, so the canvas must not cancel that selection as it does a press on the board.
describe('the writing’s class', () => {
  const pressIn = (editable: boolean) => {
    const flow = document.createElement('div');
    flow.className = articleFlowClass(editable);
    flow.setAttribute('contenteditable', String(editable));
    const words = document.createElement('p');
    words.textContent = 'Book the venue';
    flow.appendChild(words);
    return words.firstChild;
  };

  it('lets a reader pick words in writing they cannot change', () => {
    expect(articleFlowClass(false)).toContain('select-text');
    expect(cancelsCanvasSelectStart(pressIn(false))).toBe(false);
  });

  it('leaves writing being written to its editor', () => {
    expect(articleFlowClass(true)).toBe('article-flow');
    expect(cancelsCanvasSelectStart(pressIn(true))).toBe(false);
  });
});
