import type { Alternative, Comparisons } from '@liveworkspace/comparisons';
import { SITE_URL } from '@livedesign/ui';

// livedesign's comparisons, drawn by @liveworkspace/comparisons (packages/comparisons/README.md
// "livedesign"). The hub, every page, their metadata and the sitemap read this list, so adding a
// competitor is a one-place change. Bump the date with any change to them.
const UPDATED = new Date('2026-10-23');

const LIST: Alternative[] = [
  {
    slug: 'figma',
    name: 'Figma',
    highlights: ['Logo Kit export', 'Photo layers and PSD', 'No account'],
    title: 'Figma alternative for logos and wireframes · livedesign',
    description:
      'A free, open-source Figma alternative for logos, wireframes and photo edits: real-time editing, no account needed, and every feature free.',
    h1: 'A free, open-source Figma alternative for logos and wireframes',
    lede: 'Figma is the design tool most product teams already use. livedesign is smaller and more focused: logos on a square artboard, wireframes framed by their device and photos edited in layers, side by side as tabs of one design, edited live with your team and free for everyone.',
    rows: [
      {
        label: 'Price',
        us: 'Free, every feature',
        them: 'A free plan, with paid plans for more files and features',
      },
      { label: 'Open source', us: 'Yes, MIT-licensed', them: 'No, proprietary' },
      {
        label: 'Start without an account',
        us: 'Yes, create and edit as a guest',
        them: 'An account to create files',
      },
      { label: 'Real-time multiplayer', us: 'Yes, live cursors and comments', them: 'Yes' },
      {
        label: 'Logos',
        us: 'Square artboards with guides, Mirror, logo layouts and a Logo Kit export',
        them: 'Vector editing with boolean operations and a full pen tool',
      },
      {
        label: 'Wireframes',
        us: 'Phone, tablet, browser, laptop and watch frames with ready-made screens',
        them: 'Frames, components, auto layout and clickable prototypes',
      },
      {
        label: 'Photo editing',
        us: 'Layers, masks, blend modes, adjustments, 44 filters, retouching and PSD',
        them: 'Image fills with adjustments; layered pixel work usually happens elsewhere',
      },
      {
        label: 'Export',
        us: 'PDF, PNG, SVG, a Logo Kit, and JPEG, WebP or PSD for photos',
        them: 'PNG, JPG, SVG and PDF',
      },
    ],
    themBest: [
      'A complete product design tool: components, variants, variables and auto layout for a design system that grows with the product.',
      'Clickable prototypes and a developer handoff mode, for taking a design all the way to code.',
      'A large community of files, plugins and widgets, and most product designers already know it.',
      'A deeper vector editor for detailed illustration and icon work.',
    ],
    usBest: [
      'Logos, wireframes and photos in one design: each a kind of page, side by side as tabs.',
      'Logo pages with construction guides, Mirror drawing, 25 logo layouts and a Logo Kit: an SVG, PNGs from 16 to 1024 pixels and a favicon in one .zip.',
      'Wireframe pages that draw the phone, tablet, browser, laptop or watch round the screen, starting from ready-made screens.',
      'A layered photo editor on the page: masks, blend modes, adjustments, 44 filters, selection and retouching tools, and PSD in and out.',
      'A laser pointer, a spotlight and Zen mode for walking people through a design, live.',
      'Real-time editing with live cursors, comments and assigned actions, for anyone with the link, no account needed.',
      'An AI assistant connected over MCP can add logo and wireframe pages for you.',
      '33 templates to start from, by what you are making: logos and brand marks, app and website wireframes for shopping, travel, social and work, and a photo to edit.',
      'Free and MIT-licensed, with no paid tier.',
    ],
    sections: [
      {
        heading: 'Focused on the first pass',
        paragraphs: [
          'Figma is built to carry a product from the first sketch to a full design system. livedesign is built for the early, shared part of the work: the logo, the first screens and the photos that go with them, made quickly and talked through together.',
          'A logo page starts from a layout and gives you guides and Mirror drawing; a wireframe page starts from a ready-made screen in its device frame. There is less to set up, and less to learn before a teammate can help.',
        ],
      },
      {
        heading: 'Photos without leaving the design',
        paragraphs: [
          'A photo page is a layered pixel editor: masks, twenty-seven blend modes, adjustment layers, filters, brushes, selections and retouching. Open a PSD with its layers, and export a PNG, a JPEG, a WebP or a layered PSD, all in the same design as the logo and the screens.',
        ],
      },
      {
        heading: 'Free, open and no account needed',
        paragraphs: [
          'Figma has a free plan and paid plans for teams. livedesign has no paid tier at all: open the editor and start, and a guest’s design stays in their browser until they press Share, which syncs it in one step. The whole product is MIT-licensed.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can livedesign replace Figma?',
        a: 'For logos, wireframes and photo edits made together, often yes. If you need a component library, auto layout, clickable prototypes or developer handoff, Figma is the deeper product design tool.',
      },
      {
        q: 'Can I import Figma files?',
        a: 'No. livedesign imports its own JSON export and PSD files on photo pages. A Figma link can sit on the canvas as a live embed, so the two can still be seen side by side.',
      },
      {
        q: 'Do my co-editors need an account?',
        a: 'No account of any kind. Share a link and anyone who opens it can view or edit in real time. Signing in (email code or Google) is optional and mainly adds cross-device sync and teams.',
      },
      {
        q: 'Is livedesign free?',
        a: 'Yes. It is MIT-licensed open source with a free hosted version, every feature included, and no paid tier. You can even use it without creating an account at all.',
      },
    ],
  },
];

export const COMPARISONS: Comparisons = {
  app: 'livedesign',
  siteUrl: SITE_URL,
  updated: UPDATED,
  hub: {
    title: 'How livedesign compares · alternatives',
    description:
      'An honest, side-by-side comparison of livedesign with Figma, including where each is the better pick.',
    heading: 'How livedesign compares',
    lede: 'Thinking about another tool? Here is an honest, side-by-side look at how livedesign compares, including where each one is the better pick.',
  },
  alternatives: LIST,
};
