// Slide layouts (docs/specs/007-editor/illustrate-pages.md "Slide layouts"): the layouts a slide
// page starts from. Seven built for a slide here, the rest the infographic layouts that already
// set things side by side on a landscape page, filed under the slide categories. Pure builders like
// the page layouts: the slide's content box in, ordinary themed elements out, in proportions of
// the box so a 16:9 and a 4:3 slide both fit. Type is sized up for reading across a room.
import { LABEL_FONT_PX, type Element, type TextElement } from '@livediagram/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { PAGE_LAYOUTS, type PageLayout, type PageLayoutId } from './page-layouts';

export type SlideLayoutId =
  | 'slide-title'
  | 'slide-section'
  | 'slide-bullets'
  | 'slide-two-columns'
  | 'slide-image-text'
  | 'slide-statement'
  | 'slide-closing';

export type SlideLayoutCategoryId =
  'slide-openers' | 'slide-content' | 'slide-data' | 'slide-steps' | 'slide-closers';

export const SLIDE_LAYOUT_CATEGORIES: readonly { id: SlideLayoutCategoryId; label: string }[] = [
  { id: 'slide-openers', label: 'Openers' },
  { id: 'slide-content', label: 'Content' },
  { id: 'slide-data', label: 'Data' },
  { id: 'slide-steps', label: 'Steps and Time' },
  { id: 'slide-closers', label: 'Closers' },
];

// Body type on a slide: large text scaled so its glyphs stand this many units tall (a unit is the
// box's short side over 100), so a slide reads from the back of the room.
const BODY_UNITS = 4.6;

function body(k: Kit, units = BODY_UNITS): Partial<TextElement> {
  return {
    textSize: 'lg',
    textScale: Math.round(((k.u * units) / LABEL_FONT_PX.lg) * 100) / 100,
  };
}

// A short accent rule: a filled bar in the theme's colour.
function rule(k: Kit, x: number, y: number): Element {
  return k.shape('square', x, y, k.u * 14, k.u * 1.2, { label: '', borderRadius: 'full' });
}

// Bullet points down a column: a dot beside each line, the lines sharing the height they are given.
function bullets(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  lines: readonly string[],
): Element[] {
  const { u } = k;
  const rowH = Math.min(h / lines.length, u * 14);
  const dot = u * 2.2;
  return lines.flatMap((line, i) => {
    const top = y + i * rowH;
    return [
      k.shape('circle', x, top + (rowH - dot) / 2, dot, dot, { label: '' }),
      k.text(x + dot + u * 3, top, w - dot - u * 3, rowH, line, {
        ...body(k),
        textAlignY: 'middle',
      }),
    ];
  });
}

function titleSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H * 0.26;
  return [
    k.title(0, top, W * 0.85, u * 18, 'Your presentation title'),
    rule(k, 0, top + u * 21),
    k.text(0, top + u * 25, W * 0.75, u * 12, 'A subtitle that sets up the story', body(k, 5.4)),
    k.text(0, H - u * 7, W * 0.6, u * 7, 'Presenter name · October 2026', {
      ...body(k, 3.2),
      textAlignY: 'bottom',
    }),
  ];
}

function sectionSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H * 0.2;
  return [
    k.title(0, top, W * 0.3, u * 26, '01'),
    rule(k, 0, top + u * 29),
    k.title(0, top + u * 33, W * 0.8, u * 13, 'Section title'),
    k.text(0, top + u * 49, W * 0.7, u * 10, 'One line on what this section covers.', body(k)),
  ];
}

function bulletsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const head = heading(k, 'Slide title');
  return [
    ...head.els,
    ...bullets(k, 0, head.top, W * 0.9, H - head.top, [
      'Lead with the point you most want remembered',
      'Keep each line to a single idea',
      'Back it with a number or an example',
      'Say what changes because of it',
      'End on what you need from the room',
    ]),
  ];
}

function twoColumnsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Two sides of the story');
  const gap = u * 8;
  const colW = (W - gap) / 2;
  const column = (x: number, title: string, lines: string[]) => [
    k.text(x, head.top, colW, u * 9, title, { ...body(k, 5), textBold: true }),
    ...bullets(k, x, head.top + u * 12, colW, H - head.top - u * 12, lines),
  ];
  return [
    ...head.els,
    ...column(0, 'Today', ['Where we stand', 'What holds us back', 'What it costs']),
    ...column(colW + gap, 'Tomorrow', ['Where we are going', 'What unlocks it', 'What it earns']),
  ];
}

function imageTextSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const imageW = W * 0.46;
  const x = imageW + u * 8;
  const w = W - x;
  return [
    k.image(0, 0, imageW, H),
    k.title(x, H * 0.08, w, u * 11, 'The picture says it'),
    k.text(x, H * 0.08 + u * 14, w, u * 14, 'One line on what to notice in the image.', body(k)),
    ...bullets(k, x, H * 0.08 + u * 32, w, H * 0.92 - u * 32, [
      'A first detail',
      'A second detail',
      'What it means',
    ]),
  ];
}

function statementSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const textH = H * 0.42;
  const top = (H - textH - u * 14) / 2;
  return [
    // A short accent rule, centred, over the statement.
    rule(k, (W - u * 14) / 2, Math.max(0, top - u * 6)),
    k.text(W * 0.06, top, W * 0.88, textH, 'One sentence that changes how the room sees it.', {
      ...body(k, 9),
      textBold: true,
      textAlignX: 'center',
      textAlignY: 'middle',
    }),
    k.text(W * 0.15, top + textH + u * 4, W * 0.7, u * 10, 'The line that backs it up.', {
      ...body(k),
      textAlignX: 'center',
    }),
  ];
}

function closingSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H * 0.24;
  return [
    k.title(0, top, W * 0.7, u * 22, 'Thank you'),
    rule(k, 0, top + u * 25),
    k.text(0, top + u * 29, W * 0.7, u * 11, 'Questions?', { ...body(k, 6), textBold: true }),
    k.text(0, H - u * 7, W * 0.7, u * 7, 'your.name@example.com · example.com', {
      ...body(k, 3.2),
      textAlignY: 'bottom',
    }),
  ];
}

type SlideLayout = Omit<PageLayout, 'id' | 'category'> & {
  id: PageLayoutId;
  category: SlideLayoutCategoryId;
};

const own = (
  id: SlideLayoutId,
  category: SlideLayoutCategoryId,
  label: string,
  description: string,
  build: (k: Kit) => Element[],
): SlideLayout => ({ id, category, label, description, build: (b: LayoutBox) => build(kit(b)) });

// An infographic layout filed under a slide category: the same layout, the same build.
const reused = (id: PageLayoutId, category: SlideLayoutCategoryId): SlideLayout => ({
  ...PAGE_LAYOUTS.find((l) => l.id === id)!,
  category,
});

export const SLIDE_LAYOUTS: readonly SlideLayout[] = [
  own(
    'slide-title',
    'slide-openers',
    'Title slide',
    'A large title, a subtitle and the presenter',
    titleSlide,
  ),
  own(
    'slide-section',
    'slide-openers',
    'Section header',
    'A section number, its title and a line',
    sectionSlide,
  ),
  reused('agenda', 'slide-openers'),
  own(
    'slide-bullets',
    'slide-content',
    'Title and bullets',
    'A title over five bullet points',
    bulletsSlide,
  ),
  own(
    'slide-two-columns',
    'slide-content',
    'Two columns',
    'A title over two columns of bullet points',
    twoColumnsSlide,
  ),
  own(
    'slide-image-text',
    'slide-content',
    'Image and text',
    'An image on the left, a title and points on the right',
    imageTextSlide,
  ),
  own(
    'slide-statement',
    'slide-content',
    'Statement',
    'One sentence set very large, and a line under it',
    statementSlide,
  ),
  reused('quote', 'slide-content'),
  reused('big-number', 'slide-data'),
  reused('key-stats', 'slide-data'),
  reused('chart-story', 'slide-data'),
  reused('comparison', 'slide-data'),
  reused('process', 'slide-steps'),
  reused('timeline', 'slide-steps'),
  reused('roadmap', 'slide-steps'),
  own(
    'slide-closing',
    'slide-closers',
    'Thank you',
    'A thank you, a call for questions and a contact line',
    closingSlide,
  ),
  reused('team', 'slide-closers'),
];
