// The livedesign help catalogue: its categories and the articles only livedesign has (docs/specs/017-help/help-centre.md).
// Articles several apps share live in ./shared/. Moved from livedesign's own help registry; each article names the
// app it applies to.

import type { Article, Category } from '../types';

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livedesign',
    description:
      'Get to know livedesign: what it is, who it helps, and the ideas behind a free, open canvas.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a blank page to a shared design in minutes, with the basics every new user needs.',
    articleCount: 7,
  },
  {
    slug: 'tips-and-tricks',
    title: 'Tips and Tricks',
    description:
      'Work faster with the shortcuts, hidden features, and small habits experienced users rely on.',
    articleCount: 7,
  },
  {
    slug: 'account-and-data',
    title: 'Account and Data',
    description:
      'Stay in control of your work: how guest access, signing in, syncing, exporting, deletion, API tokens, connecting AI tools, and email notifications work.',
    articleCount: 9,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your designs are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livedesign REST API from your own scripts or the command line: authentication, worked examples, the CLI and developer tools, errors and limits, and the OpenAPI reference.',
    articleCount: 8,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description:
      'Get unstuck fast with fixes for the most common editor and collaboration problems.',
    articleCount: 6,
  },
  {
    slug: 'supported-devices',
    title: 'Supported Devices',
    description:
      'How livedesign works on a computer, a tablet, and a phone, and what to expect on each.',
    articleCount: 3,
  },
  {
    slug: 'policies',
    title: 'Policies',
    description:
      "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
    articleCount: 1,
  },
  {
    slug: 'contact',
    title: 'Contact',
    description: 'Get in touch, report a bug, or request a feature.',
    articleCount: 0,
  },
  // Feature-guide categories (kind: 'feature'). Rendered under "Feature Guides"
  // on the home page; each has a card-grid index at /help/<slug>/. articleCount
  // counts the feature landings in the category (each landing has its own
  // sub-guides). See liveworkspace/docs/specs/017-help/help-centre.md.
  {
    slug: 'pages',
    title: 'Pages',
    description: 'Design logos, wireframes and photos on pages, with backgrounds and exports.',
    articleCount: 6,
    kind: 'feature',
    groups: ['Basics', 'Kinds of Page'],
  },
  {
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Get your bearings in the editor: the panels, toolbar, context menus, the Map, zoom and tab bars, and quick controls.',
    articleCount: 9,
    kind: 'feature',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: one library, shared by every liveworkspace app, that keeps your designs, folders, teams and images easy to find and manage.',
    articleCount: 13,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets and Imports'],
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette: Select, Hand, Eraser, Format Painter, Laser and Spotlight.',
    articleCount: 6,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on a page: every element, your saved Library and every palette setting explained.',
    articleCount: 22,
    kind: 'feature',
    groups: ['Everyday Elements', 'Page Blocks', 'Palette Settings'],
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Work with what is on your pages: place, select, link, layer, rotate, animate, lock and theme elements, undo changes, and start from templates.',
    articleCount: 23,
    kind: 'feature',
    groups: ['Basics', 'Text and Notes', 'Styling Elements', 'Layers and Locking'],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one design: organise, link, and move between tabs of pages.',
    articleCount: 10,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, teams, sharing, walkthroughs, history and webhooks.',
    articleCount: 9,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: zen mode, light and dark mode, and cleanup.',
    articleCount: 3,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any design, folder, team, tab, or element, and add new elements to the canvas.',
    articleCount: 1,
    kind: 'feature',
  },
];

export const articles: Article[] = [
  // ---- About ----
  {
    slug: 'what-is-livedesign',
    title: 'What is livedesign?',
    description:
      'An overview of the real-time, multiplayer editor for logos, wireframes and photos.',
    keywords: 'overview intro introduction about product logos wireframes photos photo editor app',
    category: 'About livedesign',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livedesign'],
  },
  {
    slug: 'why-livedesign',
    title: 'Why Use livedesign?',
    description: 'Free, open source, no sign-in wall, real-time collaboration. Here is why.',
    keywords: 'benefits reasons comparison alternatives features advantages',
    category: 'About livedesign',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livedesign'],
  },
  // ---- Getting Started ----
  {
    slug: 'your-first-design',
    title: 'Your First Design',
    description: 'From a new design to a first page you can share, in a couple of minutes.',
    keywords:
      'start begin new create tutorial beginner basics quickstart onboarding design page logo wireframe photo picture template location',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livedesign'],
  },
  {
    slug: 'sharing-your-design',
    title: 'Sharing Your Design',
    description: 'Hand a link to anyone and edit together in real time.',
    keywords: 'share link collaborate invite send url realtime together diagram',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livedesign'],
  },
  {
    slug: 'exporting-designs',
    title: 'Exporting Designs',
    description:
      'Export pages as a PDF, PNG or SVG, a logo kit or photo files, keep a tab as JSON, or embed a live view.',
    keywords:
      'export download png svg pdf logo kit image save picture screenshot json embed backup',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: ['livedesign'],
  },
  {
    slug: 'working-with-designs',
    title: 'Working with Designs',
    description: 'Worked examples: list, read, create, and update designs, tabs, and folders.',
    keywords:
      'examples curl crud create update list read api requests designs outline view text agent share link folders trash',
    category: 'Developers',
    categorySlug: 'developers',
    apps: ['livedesign'],
  },
  {
    slug: 'edit-operations',
    title: 'Edit Operations Reference',
    description: 'Every changeset operation, selector, placement, flag and lint finding.',
    keywords:
      'changeset edit operations ops line form json selector placement flags lint findings label overflow text overflow vocabulary cli mcp agent detach component instance',
    category: 'Developers',
    categorySlug: 'developers/working-with-designs',
    parentSlug: 'working-with-designs',
    apps: ['livedesign'],
  },
  {
    slug: 'images-and-pages',
    title: 'Images, Pages and More',
    description: 'API examples for images, pages, components, renders and copies.',
    keywords:
      'images upload pages page logo wireframe photo render svg picture copy duplicate components component main instance api',
    category: 'Developers',
    categorySlug: 'developers/working-with-designs',
    parentSlug: 'working-with-designs',
    apps: ['livedesign'],
  },
  // ---- Troubleshooting ----
  {
    slug: 'design-not-loading',
    title: 'A Design Will Not Load',
    description: 'What to check when a design is blank or stuck loading.',
    keywords:
      'blank stuck loading error broken empty spinner wont open 404 diagram opening taking longer than usual colleague works for others',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
    apps: ['livedesign'],
  },
  {
    slug: 'frames',
    title: 'Frames',
    description: 'A labelled section that draws behind its contents and moves them as one.',
    keywords:
      'frame section container backdrop labelled box region area cluster move together carries contents behind resize outline f key figjam section export framing nest nested centre quick connect plus fill background',
    category: 'Palette',
    categorySlug: 'palette',
    group: 'Everyday Elements',
    apps: ['livedesign'],
  },
  {
    slug: 'logo-pages',
    title: 'Logo Pages',
    description:
      'Design a logo on a square artboard with guides, mirror, wordmarks, combined shapes and a logo kit.',
    keywords:
      'logo logos brand branding draw drawing pen bezier path freehand pencil sketch marker markers fill tool paint bucket colour in color in shape pen mark wordmark lettermark monogram icon favicon app icon avatar artboard guides keyline grid safe area symmetry mirror reflect flip radial rotational kaleidoscope four way horizontal vertical axis copies merge combine boolean union unite subtract intersect exclude merge shapes tracking letter spacing kerning arc curved text circle text badge emblem logo kit export png svg ico transparent',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
    apps: ['livedesign'],
  },
  {
    slug: 'pen-and-points',
    title: 'The Pen and Edit Points',
    description: 'Draw precise paths with the Pen, then reshape every point and handle.',
    keywords:
      'pen path tool bezier curve vector anchor node point handle corner smooth mirrored aligned close path open path edit points reshape trace outline simplify combine logo',
    category: 'Pages',
    categorySlug: 'pages/logo-pages',
    parentSlug: 'logo-pages',
    group: 'Kinds of Page',
    apps: ['livedesign'],
  },
  {
    slug: 'wireframe-pages',
    title: 'Wireframe Pages',
    description:
      'Wireframe a screen inside a phone, tablet, laptop, desktop, browser or watch frame, from ready-made screens.',
    keywords:
      'wireframe wireframes mockup mock up mockups prototype ui ux screen screens app design device frame phone iphone android mobile tablet ipad laptop desktop monitor browser website web page watch smartwatch status bar dynamic island notch home indicator landscape portrait safe area sign in login onboarding dashboard settings profile checkout pricing chat feed landing page button text field input search switch toggle placeholder inspect measure spacing handoff developer css',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
    apps: ['livedesign'],
  },
  {
    slug: 'photo-pages',
    title: 'Photo Pages',
    description:
      'Edit pictures in a page: layers, masks, brushes, smart selections, healing, adjustments, filters and PSD.',
    keywords:
      'photo photos picture pictures image images photoshop paint net gimp edit editing editor retouch retouching layer layers mask masks blend blending mode opacity group clipping brush pencil eraser background eraser clone stamp heal healing spot heal red eye blemish remove object content aware fill gradient paint bucket fill blur sharpen smudge dodge burn sponge text shape crop straighten rotate flip resize resample image size canvas size select selection marquee lasso magnetic magic wand quick select subject remove background cutout transparent colour range color range feather adjust adjustment levels curves exposure brightness contrast hue saturation vibrance colour balance color balance white balance temperature black and white monochrome photo filter channel mixer selective colour gradient map invert posterize threshold shadows highlights filter filters gaussian motion radial lens tilt shift bokeh unsharp mask noise grain median emboss oil paint pixelate mosaic halftone distort twirl pinch spherize wave ripple polar clouds vignette lens flare clarity dehaze histogram psd png jpeg jpg webp export layers as files',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
    apps: ['livedesign'],
  },
  {
    slug: 'make-sizes',
    title: 'Make Sizes',
    description:
      'Turn one photo into a photo page for every social format, then export them all as one .zip.',
    keywords:
      'make sizes resize social sizes formats instagram post story linkedin banner x header facebook cover youtube thumbnail custom crop fill export all sizes zip batch photo',
    category: 'Pages',
    categorySlug: 'pages/photo-pages',
    parentSlug: 'photo-pages',
    group: 'Kinds of Page',
    apps: ['livedesign'],
  },
  {
    slug: 'add-to-design',
    title: 'Add a Tab to Another Design',
    description: 'Add the active tab to another design you own; both share the same live tab.',
    keywords: 'reuse share tab sync across designs diagrams move copy live',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livedesign'],
  },
  {
    slug: 'history',
    title: 'History',
    description: 'Who changed the design and when, with its snapshots on the same timeline.',
    keywords:
      'history timeline activity log who changed what when edits audit events at a glance snapshots versions changes recent activity tools',
    category: 'Collaboration',
    categorySlug: 'collaboration',
    apps: ['livedesign'],
  },
  {
    slug: 'team-shared-designs',
    title: 'Team Shared Designs',
    description: 'A per-team folder tree every member can manage.',
    keywords: 'shared library folder team files workspace common diagrams',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
    apps: ['livedesign'],
  },
  // ---- Sub-articles: Wireframe Pages ----
  {
    slug: 'inspect',
    title: 'Inspect',
    description:
      'Read any element’s size, spacing, colours and type off a wireframe, copy it as CSS, and export it.',
    keywords:
      'inspect inspector measure measurement measurements redline redlines spacing gap gaps distance padding margin size width height position developer developers dev handoff hand off hand-off build spec specs specification css copy css copy values points pt px colour color hex fill border radius corner font typography line height export element png svg 1x 2x 3x link viewer',
    category: 'Pages',
    categorySlug: 'pages/wireframe-pages',
    parentSlug: 'wireframe-pages',
    apps: ['livedesign'],
  },
  {
    slug: 'prototypes',
    title: 'Clickable Prototypes',
    description:
      'Link screens together, click through them in Prototype mode, share a prototype link, and see every link in the Flow view.',
    keywords:
      'prototype prototypes clickable click through walk through walkthrough link links linking hotspot hotspots screen screens flow flows flow view arrows map user journey navigation transition transitions slide dissolve instant back button broken link handle play preview demo test usability share link phone mobile figma invision marvel',
    category: 'Pages',
    categorySlug: 'pages/wireframe-pages',
    parentSlug: 'wireframe-pages',
    apps: ['livedesign'],
  },
  {
    slug: 'search-designs',
    title: 'Finding Designs and Folders',
    description: 'Find your designs from the editor, and your items and folders from the Explorer.',
    keywords: 'find lookup locate files library open diagrams',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
    apps: ['livedesign'],
  },
];
