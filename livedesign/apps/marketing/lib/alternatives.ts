import type { Alternative, Comparisons } from '@liveworkspace/comparisons';
import { SITE_URL } from '@livedesign/ui';

// livedesign's comparisons, drawn by @liveworkspace/comparisons (packages/comparisons/README.md
// "livedesign"). The hub, every page, their metadata and the sitemap read this list, so adding a
// competitor is a one-place change. Bump the date with any change to them.
const UPDATED = new Date('2026-11-18');

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
        us: 'Square artboards with guides, Mirror, 25 logo layouts, a Display Library of 90 faces and a Logo Kit export',
        them: 'Vector editing with boolean operations and a full pen tool',
      },
      {
        label: 'Wireframes',
        us: 'Phone, tablet, laptop, desktop, browser and watch frames with ready-made screens, components, linked prototypes with a Flow view, and Inspect for handoff',
        them: 'Frames, components, auto layout and advanced prototyping',
      },
      {
        label: 'Photo editing',
        us: 'Layers, masks, blend modes, adjustments, 44 filters, retouching and PSD',
        them: 'Image adjustments, plus AI tools to erase, isolate, expand and remove backgrounds; no pixel layers or PSD',
      },
      {
        label: 'Export',
        us: 'PDF, PNG, SVG, a Logo Kit, and JPEG, WebP or PSD for photos',
        them: 'PNG, JPG, SVG and PDF',
      },
      {
        label: 'Import',
        us: 'Its own JSON export, SVG as editable shapes, and PSD on photo pages',
        them: 'Figma and Sketch files, PowerPoint decks, PNG and JPG images, and SVG as editable vectors',
      },
    ],
    themBest: [
      'A complete product design tool: components, variants, variables and auto layout for a design system that grows with the product.',
      'Advanced prototyping, with overlays, variables and smart animation, and Dev Mode for taking a design all the way to code.',
      'A large community of files, plugins and widgets, and most product designers already know it.',
      'A deeper vector editor, with Figma Draw adding brushes, textures and variable-width strokes for detailed illustration.',
      'Built-in AI image tools that generate pictures, erase or isolate objects and expand an image past its edges.',
    ],
    usBest: [
      'Logos, wireframes and photos in one design: each a kind of page, side by side as tabs.',
      'Logo pages with construction guides, Mirror drawing, 25 logo layouts, a Display Library of 90 free faces for wordmarks, and a Logo Kit: an outlined SVG, PNGs from 16 to 1024 pixels and a favicon in one .zip.',
      'Bring an SVG logo or icon in and it lands as shapes you can recolour and reshape with the Pen, not a flat picture.',
      'Wireframe pages that draw the phone, tablet, laptop, browser or watch round the screen, starting from ready-made screens that arrive already linked, so Prototype clicks straight through them on a desktop or a phone, and Inspect hands every size, gap and colour to whoever builds them.',
      'A layered photo editor on the page: masks, blend modes, adjustments, 44 filters, selection and retouching tools, and PSD in and out.',
      'A laser pointer, a spotlight and Zen mode for walking people through a design live, and Walkthroughs to record a narrated tour of it for anyone who missed the call.',
      'Real-time editing with live cursors, comments and assigned actions, for anyone with the link, no account needed.',
      'An AI assistant connected over MCP can add logo, wireframe and photo pages for you, and in Claude a live view of the design opens beside the answer.',
      'A Personal or team Library: save any selection once, then drop it into every design.',
      '36 templates to start from, by what you are making: logos, brand boards and marks, clickable app and website wireframes for shopping, travel, social and work, and a photo to edit.',
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
          'Figma edits pictures too, with adjustments and AI tools that erase, isolate or expand an image. A livedesign photo page goes further into the pixels by hand: layers you paint, mask and blend, and a PSD that opens with its layers intact.',
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
        a: 'For logos, wireframes and photo edits made together, often yes. If you need variants, variables, auto layout or advanced prototyping, Figma is the deeper product design tool. A livedesign wireframe’s screens can be linked and clicked through as a prototype, and developers can read their sizes, spacing and colours with Inspect.',
      },
      {
        q: 'Can I import Figma files?',
        a: 'There is no Figma importer, so a Figma file does not come across. A logo or icon exported from Figma as an SVG comes in as editable shapes (outline its text first, since text and masks are left out), and a PSD opens on a photo page. A Figma link can also sit on the canvas as a live embed, so the two can be seen side by side.',
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
