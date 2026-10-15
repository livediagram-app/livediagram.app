// The sitemap builder (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// ./template-builders-hierarchies (which re-exports it). Pure: (cx, cy) -> Element[].

import {
  createText,
  MIND_CONNECTOR_LOOK,
  runsPlainText,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type TextRun,
} from '@livediagram/document';
import { buildMindTemplate, mindHowTo, type MindSpec } from './template-builders-mindmaps';

// Sitemap: a real product site's page tree, the way a web team plans one,
// built from MIND NODES in the downward flow (docs/specs/009-elements/mind-node.md
// "Templates") so it is a live tree rather than a picture of one: Tab on a
// section adds a page under it, Enter adds a sibling, and the outline and Tidy
// Map work on it. Home (bold, a house glyph) sits on top. The three top-nav
// sections hang below it, each in its own hue with a glyph for what it holds,
// and every page carries a line-art glyph for its page type plus its route in
// muted grey on its second line, so the boxes read as URLs to build and the
// route travels with its page when the map is tidied or grown. The pages that
// live OUTSIDE the nav hang off Home on dashed lines, the footer's company
// pages on the far left and the sign-in utility pages on the far right.
// Square lines with no arrowheads: a sitemap shows structure, not flow.
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
// The mind map's own connector look carrying the Professional finish (docs/specs/008-canvas/finish.md), so
// the lines draw as one square bus per parent, the sitemap convention, whatever the tab's finish, and a
// page grown later copies it (growth copies a sibling connector's finish with its look).
const LINE: Partial<ArrowElement> = { ...MIND_CONNECTOR_LOOK, finish: 'professional' };
const OUTSIDE: MindHue = { fill: '#f8fafc', stroke: '#94a3b8', ink: '#334155', leaf: '#cbd5e1' };
type MindHue = Section['hue'];

// A page: its name over its route in muted grey, on one node.
const pageRuns = (p: Page): TextRun[] => [
  { text: p.label },
  { text: `\n${p.route}`, size: 'sm', color: MUTED },
];

const pageSpec = (p: Page, hue: MindHue, dashed: boolean): MindSpec => {
  const runs = pageRuns(p);
  return {
    label: runsPlainText(runs),
    look: {
      // Wide enough for the longest route with its glyph (/product/integrations) on one line.
      width: 210,
      height: 60,
      textSize: 'sm',
      iconId: p.icon,
      richText: runs,
      fillColor: '#ffffff',
      strokeColor: hue.leaf,
      textColor: '#334155',
    },
    connector: { ...LINE, strokeColor: hue.leaf, ...(dashed ? { strokeStyle: 'dashed' } : {}) },
  };
};

const groupSpec = (
  label: string,
  icon: string,
  hue: MindHue,
  pages: Page[],
  dashed: boolean,
): MindSpec => ({
  label,
  look: {
    width: 180,
    height: 60,
    textSize: 'md',
    textBold: true,
    iconId: icon,
    fillColor: hue.fill,
    strokeColor: hue.stroke,
    textColor: hue.ink,
    strokeWidth: dashed ? 'medium' : 'thick',
    ...(dashed ? { strokeStyle: 'dashed' } : {}),
  },
  connector: {
    ...LINE,
    strokeColor: hue.stroke,
    strokeWidth: dashed ? 2 : 3,
    ...(dashed ? { strokeStyle: 'dashed' } : {}),
  },
  children: pages.map((p) => pageSpec(p, hue, dashed)),
});

export function buildSitemap(cx: number, cy: number): Element[] {
  const map = buildMindTemplate(
    {
      label: 'Home',
      look: { width: 220, height: 72, textSize: 'lg', iconId: 'home', colorPreset: 'bold' },
      children: [
        groupSpec(FOOTER[0], 'menu', OUTSIDE, FOOTER[1], true),
        ...SITE_SECTIONS.map((sec) => groupSpec(sec.label, sec.icon, sec.hue, sec.pages, false)),
        groupSpec(UTILITY[0], 'settings', OUTSIDE, UTILITY[1], true),
      ],
    },
    'downward',
    cx,
    cy,
  );
  const nodes = map.filter((el): el is ShapeElement => el.type === 'shape');
  const left = Math.min(...nodes.map((n) => n.x));
  const right = Math.max(...nodes.map((n) => n.x + n.width));
  const top = Math.min(...nodes.map((n) => n.y));
  return [
    {
      ...createText(left, top - 112),
      width: right - left,
      height: 44,
      label: 'brightside.app · sitemap',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top - 68),
      width: right - left,
      height: 28,
      label:
        'One node per page, grouped under the top nav, with its route beneath. Dashed branches are pages outside the nav.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
    ...map,
    mindHowTo(map, 'Select a section, then press Tab to add a page or Enter to add a sibling.'),
  ];
}
