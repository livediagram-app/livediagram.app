// Tab Style's frame sample (docs/specs/011-theme/canvas-and-theme-dialog.md "Previews"): a small UI frame, a header
// line, a title, a card with a line of copy and a button, and the arrow to a second screen, on the background new
// pages start on, drawn by the page exporter in the tab's theme, finish and font, so the sample is what a page of the
// tab will look like. Pure.
import {
  layOutPages,
  pagesInkFor,
  renderPageToSvg,
  type Element,
  type Finish,
  type Page,
  type PageBackground,
  type Tab,
  type TextSize,
} from '@livedesign/design';
import { withThemeApplied } from '@/lib/tab-theme-apply';

const PAGE_ID = 'tab-style-frame';
// The frame's sides: a small landscape screen, wide enough for two cards.
export const FRAME_PREVIEW_SIDES = { width: 560, height: 320 } as const;

// What sits on the frame, in its own coordinates (the page's top left at 0, 0).
function frameElements(textSize: TextSize | undefined): Element[] {
  const body = textSize ?? 'sm';
  return [
    {
      id: 'frame-title',
      type: 'text',
      x: 32,
      y: 24,
      width: 300,
      height: 40,
      label: 'Welcome back',
      textSize: textSize ?? 'lg',
      textAlignX: 'left',
    },
    {
      id: 'frame-card',
      type: 'shape',
      shape: 'square',
      x: 32,
      y: 90,
      width: 220,
      height: 150,
      label: 'Your week at a glance',
      textSize: body,
    },
    {
      id: 'frame-button',
      type: 'shape',
      shape: 'stadium',
      x: 330,
      y: 120,
      width: 180,
      height: 56,
      label: 'Get started',
      textSize: body,
    },
    {
      id: 'frame-arrow',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'frame-card', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'frame-button', anchor: 'w' },
    },
  ] as Element[];
}

/** The frame sample as SVG markup: on `background` (the paper when undefined), in the tab's theme, finish and font. */
export function framePreviewSvg(opts: {
  background: PageBackground | undefined;
  theme: string;
  finish: Finish;
  font?: string;
  // The size new text takes (the Text panel); the sample's own sizes when omitted.
  textSize?: TextSize;
}): string {
  const own = opts.background && (opts.background.fill || opts.background.pattern);
  const sheet: Page = {
    id: PAGE_ID,
    orientation: 'landscape',
    size: 'fit',
    fit: { ...FRAME_PREVIEW_SIDES },
    ...(own ? { background: opts.background } : {}),
  };
  const page = layOutPages([sheet])[0]!;
  const { x, y } = page.rect;
  const elements = frameElements(opts.textSize).map((el) =>
    el.type === 'arrow' ? el : { ...el, x: el.x + x, y: el.y + y },
  ) as Element[];
  const blank: Tab = { id: PAGE_ID, name: 'Sample', elements, pages: [page] };
  // The theme's colours, then re-inked for the page as a pick of its background re-inks (a dark page's text light).
  const themed = withThemeApplied(blank, opts.theme);
  const inked = page.background
    ? pagesInkFor(themed, [{ pageId: PAGE_ID, background: page.background }]).tab
    : themed;
  return renderPageToSvg(
    { ...inked, finish: opts.finish, ...(opts.font ? { font: opts.font } : {}) },
    page,
  );
}
