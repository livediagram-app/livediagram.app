// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { EDITOR_VIEWPORT_ATTR, editorViewportOf } from './editor-viewport';

// docs/specs/007-editor/split-view.md "How the editor fits in its pane"
describe('editorViewportOf', () => {
  afterEach(() => document.body.replaceChildren());

  const mount = (mode: 'pane' | 'window' | null) => {
    const box = document.createElement('div');
    if (mode) box.setAttribute(EDITOR_VIEWPORT_ATTR, mode);
    box.getBoundingClientRect = () => ({ left: 700, width: 740 }) as DOMRect;
    const inner = document.createElement('span');
    box.append(inner);
    document.body.append(box);
    return inner;
  };

  it("measures a split's pane from its own edge", () => {
    expect(editorViewportOf(mount('pane'))).toMatchObject({ left: 700, width: 740 });
  });

  it('is the window with no split, or outside the editor', () => {
    expect(editorViewportOf(mount('window'))).toMatchObject({ left: 0, width: window.innerWidth });
    expect(editorViewportOf(mount(null))).toEqual({
      left: 0,
      width: window.innerWidth,
      element: null,
    });
    expect(editorViewportOf(null).element).toBeNull();
  });
});
