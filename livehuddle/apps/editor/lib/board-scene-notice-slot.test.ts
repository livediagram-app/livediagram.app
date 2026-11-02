import { describe, expect, it } from 'vitest';
import { NOTICE_GAP_PX, noticeBottom } from './board-scene-notice-slot';

// docs/specs/020-import-export/board-scene.md "In the editor": the notice's own slot above the dock.
describe('noticeBottom', () => {
  it('sits just above the dock, whatever the width', () => {
    for (const viewportWidth of [640, 1400, 1760, 2560]) {
      expect(
        noticeBottom({ viewportWidth, viewportHeight: 900, dockTop: 760, canvasBottom: 860 }),
      ).toBe(900 - 760 + NOTICE_GAP_PX);
    }
  });

  it('takes a dock’s slot without one: lifted until the window is wide', () => {
    expect(
      noticeBottom({ viewportWidth: 1400, viewportHeight: 900, dockTop: null, canvasBottom: 860 }),
    ).toBe(900 - (860 - 68) + NOTICE_GAP_PX);
    expect(
      noticeBottom({ viewportWidth: 1800, viewportHeight: 900, dockTop: null, canvasBottom: 860 }),
    ).toBe(900 - (860 - 16) + NOTICE_GAP_PX);
  });
});
