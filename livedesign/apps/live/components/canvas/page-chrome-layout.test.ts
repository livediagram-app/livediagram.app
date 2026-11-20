// A page's title bar beside the Quick Style bar (docs/specs/008-canvas/quick-style-panel.md "Named while the title bar
// is"): the two name their buttons only while the page on screen holds both named, so the pair never runs off the
// page's left edge into the Contents panel.
import { describe, expect, it } from 'vitest';
import type { LaidOutPage } from '@livedesign/design';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { pageChromeLayout } from './page-chrome-layout';
import { LABEL_MIN, titleBarFixedRoom } from './page-title-bar-room';
import { quickStyleBarNamedRoom } from './quick-style-bar-room';

const named = titleBarFixedRoom(
  { edit: true, locked: false, logo: false, page: true, device: true },
  true,
);
const bar = quickStyleBarNamedRoom(['stroke', 'background', 'width', 'style', 'textAlign']);

const pageOf = (width: number) =>
  ({
    id: 'p',
    kind: 'wireframe',
    index: 0,
    rect: { x: 0, y: 0, width, height: 800 },
  }) as unknown as LaidOutPage;
const view = {
  pages: [pageOf(400)],
  edit: { contentCount: () => 1 },
} as unknown as PagesModeView;
const layoutOf = (width: number, px: number | null) =>
  pageChromeLayout(pageOf(width), {
    view,
    zoom: 1,
    bare: false,
    mobile: false,
    quickStyleRoom: px === null ? null : { pageId: 'p', px, namedPx: bar },
    quickStylePhone: null,
  });

describe("a page's title bar beside the Quick Style bar", () => {
  it('names its buttons alone while the page holds them and the label', () => {
    expect(layoutOf(named + LABEL_MIN, null).labelled).toBe(true);
  });

  it('drops to its icons, with the bar, where the page cannot hold both named', () => {
    // The phone wireframe at about 100 %: room for the named title bar, not for the bar named beside it too.
    expect(layoutOf(named + LABEL_MIN, 180).labelled).toBe(false);
    // Whatever the bar measures drawn as icons, its named room decides, so the choice never flips back.
    expect(layoutOf(named + LABEL_MIN, 8).labelled).toBe(false);
  });

  it('names both while the page holds both named and the label', () => {
    expect(layoutOf(named + bar + LABEL_MIN, bar).labelled).toBe(true);
  });

  it("ignores a bar beside another page's title bar", () => {
    const other = pageChromeLayout(pageOf(named + LABEL_MIN), {
      view,
      zoom: 1,
      bare: false,
      mobile: false,
      quickStyleRoom: { pageId: 'q', px: bar, namedPx: bar },
      quickStylePhone: null,
    });
    expect(other.labelled).toBe(true);
  });
});

describe('the Quick Style bar named', () => {
  it('takes no room with no buttons, and more with each one', () => {
    expect(quickStyleBarNamedRoom([])).toBe(0);
    expect(quickStyleBarNamedRoom(['stroke', 'background'])).toBeGreaterThan(
      quickStyleBarNamedRoom(['stroke']),
    );
  });
});
