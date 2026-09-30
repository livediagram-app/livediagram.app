// The sitemap builder (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// ./template-builders-hierarchies (which re-exports it) once it gained page
// glyphs, section hues and the utility / footer groups. Pure:
// (cx, cy) -> Element[].

import {
  createPinnedArrow,
  createShape,
  createText,
  type Anchor,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { BOTTOM_EXITS, rake } from './template-rake';

// Sitemap: a real product site's page tree, the way a web team plans one.
// Home (bold, a house glyph) sits on top. The three top-nav sections hang
// below it, each in its own hue with a glyph for what it holds, and every
// page carries a line-art glyph for its page type (a list, an article, a
// form) plus its route in muted grey underneath, so the boxes read as URLs to
// build rather than people in an org chart. Pages that live OUTSIDE the nav
// flank Home on dashed lines: the footer's company pages on the left, the
// sign-in utility pages on the right. Every connector is a square rake, the
// sitemap convention: down, across, down, arriving square on the child's top.
type Page = { label: string; icon: string; route: string };
type Section = {
  label: string;
  icon: string;
  hue: { fill: string; stroke: string; ink: string; leaf: string };
  pages: [Page, Page];
};

const SITE_SECTIONS: Section[] = [
  {
    label: 'Product',
    icon: 'box',
    hue: { fill: '#e0f2fe', stroke: '#0ea5e9', ink: '#075985', leaf: '#7dd3fc' },
    pages: [
      { label: 'Features', icon: 'zap', route: '/product/features' },
      { label: 'Integrations', icon: 'link', route: '/product/integrations' },
    ],
  },
  {
    label: 'Pricing',
    icon: 'dollar-sign',
    hue: { fill: '#d1fae5', stroke: '#10b981', ink: '#065f46', leaf: '#6ee7b7' },
    pages: [
      { label: 'Plans', icon: 'layers', route: '/pricing' },
      { label: 'FAQ', icon: 'help-circle', route: '/pricing/faq' },
    ],
  },
  {
    label: 'Resources',
    icon: 'book',
    hue: { fill: '#ede9fe', stroke: '#8b5cf6', ink: '#5b21b6', leaf: '#c4b5fd' },
    pages: [
      { label: 'Blog', icon: 'file-text', route: '/blog' },
      { label: 'Changelog', icon: 'clock', route: '/changelog' },
    ],
  },
];
// Outside the nav: [group caption, pages] for the left and right flanks.
const FOOTER: [string, Page[]] = [
  'Footer',
  [
    { label: 'About us', icon: 'info', route: '/about' },
    { label: 'Careers', icon: 'briefcase', route: '/careers' },
  ],
];
const UTILITY: [string, Page[]] = [
  'Utility',
  [
    { label: 'Log in', icon: 'lock', route: '/login' },
    { label: 'Sign up', icon: 'user-plus', route: '/signup' },
  ],
];

const MUTED = '#64748b';
// A sitemap shows structure: plain lines, no arrowheads.
const LINE = { arrowEnds: 'none', arrowStyle: 'angled' } as const;

export function buildSitemap(cx: number, cy: number): Element[] {
  const homeW = 240;
  const homeH = 76;
  const sectionW = 340;
  const sectionH = 64;
  const pageW = 150;
  const pageH = 52;
  const routeH = 24;
  const sidePageW = 170;
  const sidePageH = 44;
  const sectionPitch = 420;
  const titleH = 44;
  const captionH = 28;
  const levelGap = 76;
  // Home's row is taller than Home: the flanks stack two pages (and their
  // routes) level with it, so the row gets extra room above and below and
  // the rake's elbows still land in open canvas.
  const flankPitch = sidePageH + routeH + 16;
  const flankH = flankPitch * 2 - 16;
  const homeRowPad = (flankH - homeH) / 2;
  const totalW = sectionPitch * 2 + sectionW;
  const totalH =
    titleH + captionH + 40 + flankH + levelGap + 24 + sectionH + levelGap + pageH + routeH;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const homeY = top + titleH + captionH + 40 + homeRowPad;
  const sectionY = homeY + homeH + homeRowPad + levelGap + 24;
  const pageY = sectionY + sectionH + levelGap;

  const elements: Element[] = [
    {
      ...createText(left, top),
      width: totalW,
      height: titleH,
      label: 'brightside.app · sitemap',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: totalW,
      height: captionH,
      label:
        'One card per page, grouped under the top nav, with its route beneath. Dashed lines are pages outside the nav.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  const arrows: Element[] = [];

  const home: ShapeElement = {
    ...createShape('square', cx - homeW / 2, homeY),
    width: homeW,
    height: homeH,
    label: 'Home',
    textSize: 'lg',
    iconId: 'home',
    colorPreset: 'bold',
  };
  elements.push(home);

  // A page card with its route in muted grey underneath.
  const page = (
    p: Page,
    x: number,
    y: number,
    w: number,
    h: number,
    look: Partial<ShapeElement>,
  ) => {
    const card: ShapeElement = {
      ...createShape('square', x, y),
      width: w,
      height: h,
      label: p.label,
      textSize: 'sm',
      iconId: p.icon,
      ...look,
    };
    elements.push(card, {
      ...createText(x, y + h + 4),
      width: w,
      height: routeH,
      label: p.route,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'center',
    });
    return card;
  };

  // The flanks: two stacked pages either side of Home on dashed lines, each
  // leaving Home's side from its own point (upper / lower third).
  const flank = ([caption, pages]: [string, Page[]], side: -1 | 1) => {
    const x = side === 1 ? cx + homeW / 2 + 120 : cx - homeW / 2 - 120 - sidePageW;
    const y0 = homeY + homeH / 2 - flankH / 2;
    elements.push({
      ...createText(x, y0 - 28),
      width: sidePageW,
      height: 24,
      label: caption,
      textSize: 'sm',
      textBold: true,
      textColor: MUTED,
      textAlignX: 'left',
    });
    pages.forEach((p, i) => {
      const card = page(p, x, y0 + i * flankPitch, sidePageW, sidePageH, {
        fillColor: '#ffffff',
        strokeColor: '#94a3b8',
        textColor: '#334155',
      });
      const out: Anchor = side === 1 ? (i === 0 ? 'ene' : 'ese') : i === 0 ? 'wnw' : 'wsw';
      // Across, a step in the middle of the gap, across: Home's side and
      // the page sit at different heights, and a mid-gap step reads as
      // deliberate where an auto elbow jogged at the card's edge.
      const from = {
        x: side === 1 ? home.x + homeW : home.x,
        y: homeY + homeH * (i === 0 ? 0.25 : 0.75),
      };
      const to = { x: side === 1 ? card.x : card.x + sidePageW, y: card.y + sidePageH / 2 };
      const my = (from.y + to.y) / 2;
      arrows.push({
        ...createPinnedArrow(home.id, out, card.id, side === 1 ? 'w' : 'e'),
        ...LINE,
        strokeStyle: 'dashed',
        curvePoints: [
          { dx: 0, dy: from.y - my },
          { dx: 0, dy: to.y - my },
        ],
      });
    });
  };
  flank(FOOTER, -1);
  flank(UTILITY, 1);

  SITE_SECTIONS.forEach((section, i) => {
    const sx = cx + (i - 1) * sectionPitch;
    const { hue } = section;
    const sectionEl: ShapeElement = {
      ...createShape('square', sx - sectionW / 2, sectionY),
      width: sectionW,
      height: sectionH,
      label: section.label,
      textSize: 'md',
      textBold: true,
      iconId: section.icon,
      fillColor: hue.fill,
      strokeColor: hue.stroke,
      textColor: hue.ink,
      strokeWidth: 'thick',
    };
    elements.push(sectionEl);
    const [anchor, fx] = BOTTOM_EXITS[i]!;
    arrows.push({
      ...createPinnedArrow(home.id, anchor, sectionEl.id, 'n'),
      ...LINE,
      curvePoints: rake({ x: home.x + homeW * fx, y: homeY + homeH }, { x: sx, y: sectionY }),
    });

    // Two pages per section, each centred under its own quarter of the
    // section's bottom edge so its line drops straight.
    section.pages.forEach((p, j) => {
      const px = sx + (j === 0 ? -0.25 : 0.25) * sectionW;
      const card = page(p, px - pageW / 2, pageY, pageW, pageH, {
        fillColor: '#ffffff',
        strokeColor: hue.leaf,
        textColor: '#334155',
      });
      arrows.push({
        ...createPinnedArrow(sectionEl.id, j === 0 ? 'ssw' : 'sse', card.id, 'n'),
        ...LINE,
        curvePoints: rake(
          { x: sx + (j === 0 ? -0.25 : 0.25) * sectionW, y: sectionY + sectionH },
          { x: px, y: pageY },
        ),
      });
    });
  });

  return [...elements, ...arrows];
}
