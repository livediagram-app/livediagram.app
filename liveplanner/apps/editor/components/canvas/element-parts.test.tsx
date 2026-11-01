// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EdgeResizeHandle, ResizeHandles } from './element-parts';

// A grip's touch pad leans outward (docs/specs/008-canvas/canvas-and-palette.md "Touch targets"): toward the
// element it reaches only 4 px past the grip. An even 16 px pad reached 19 to 22 px into the element from each
// edge and corner, so on a phone a finger on a small element's body caught a grip and resized it.
const INWARD = /pointer-coarse:before:(top|right|bottom|left)-\[-4px\]/;

describe('resize grips on a touch screen', () => {
  it('leans each corner pad outward', () => {
    const { container } = render(<ResizeHandles elementId="a" zoom={1} onBeginDrag={vi.fn()} />);
    const handles = [...container.querySelectorAll<HTMLElement>('[data-canvas-handle]')];
    expect(handles.length).toBeGreaterThan(0);
    for (const h of handles) expect(h.className).toMatch(INWARD);
  });

  it('leans each edge pad outward', () => {
    for (const anchor of ['n', 'e', 's', 'w'] as const) {
      const { container, unmount } = render(
        <EdgeResizeHandle anchor={anchor} elementId="a" zoom={1} onBeginDrag={vi.fn()} />,
      );
      const handle = container.firstElementChild as HTMLElement;
      expect(handle.className).toMatch(INWARD);
      unmount();
    }
  });
});
