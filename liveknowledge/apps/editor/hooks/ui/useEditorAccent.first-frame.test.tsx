// @vitest-environment jsdom
// Themed from the first frame (docs/specs/030-knowledgebase/page-surface.md, Work Tracker 1521): the tint and the
// light ground are in <head> by the time the commit that first draws the editor is laid out, before the browser
// paints, so no frame shows the knowledgebase in the product's own colours.
import { useLayoutEffect, type ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEditorAccent } from './useEditorAccent';

afterEach(cleanup);

type Styles = { tint: boolean; ground: boolean };
const styles = (): Styles => ({
  tint: document.getElementById('lvd-editor-accent') !== null,
  ground: document.getElementById('lk-light-ground') !== null,
});

function Editor({ theme }: { theme: string }) {
  useEditorAccent(theme);
  return null;
}

// What the page held at the first layout: a parent's layout effect runs after its children's, before the browser
// paints and before any passive effect.
function FirstFrame({ children, seen }: { children: ReactNode; seen: (s: Styles) => void }) {
  useLayoutEffect(() => {
    seen(styles());
  });
  return children;
}

describe('the theme before the first paint', () => {
  // A light theme, a dark one and a multi-colour one.
  it.each(['steel', 'midnight', 'rainbow'])(
    'is in place in the commit that draws the editor (%s)',
    (theme) => {
      let first: Styles | null = null;
      render(
        <FirstFrame seen={(s) => (first ??= s)}>
          <Editor theme={theme} />
        </FirstFrame>,
      );
      expect(first).toEqual({ tint: true, ground: true });
    },
  );

  it("adds nothing under the product's own theme, and takes the tint away on leaving", () => {
    const { rerender, unmount } = render(<Editor theme="steel" />);
    expect(styles()).toEqual({ tint: true, ground: true });
    rerender(<Editor theme="brand" />);
    expect(styles()).toEqual({ tint: false, ground: false });
    rerender(<Editor theme="steel" />);
    unmount();
    expect(styles()).toEqual({ tint: false, ground: false });
  });
});
