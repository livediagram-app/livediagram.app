// The livedocuments help catalogue: its categories and the articles only livedocuments has (docs/specs/016-help/help-centre.md).
// Articles several apps share live in ./shared/. Moved from livedocuments's own help registry; each article names the
// app it applies to.

import type { Article, Category } from '../types';

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livedocuments',
    description:
      'Get to know livedocuments: what it is, who it helps, and the ideas behind a free, open canvas.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a blank page to a shared document in minutes, with the basics every new user needs.',
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
      'Stay in control of your work: how guest access, signing in, syncing, exporting, deletion, API tokens, connecting AI tools, and email and phone notifications work.',
    articleCount: 10,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your documents are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livedocuments REST API from your own scripts or the command line: authentication, worked examples, the CLI and developer tools, errors and limits, and the OpenAPI reference.',
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
      'How livedocuments works on a computer, a tablet, and a phone, and what to expect on each.',
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
  // sub-guides). See liveworkspace/docs/specs/016-help/help-centre.md.
  {
    slug: 'pages',
    title: 'Pages',
    description:
      'Build documents out of pages: articles, slide decks and infographics, with layouts, backgrounds and exports.',
    articleCount: 7,
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
      'Organise everything you build: one library, shared by every liveworkspace app, that keeps your documents, folders, teams and images easy to find and manage.',
    articleCount: 14,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets and Imports'],
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette: Select, Hand, Format Painter, Laser, Spotlight and Slide Deck.',
    articleCount: 6,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on a page: every element and palette setting explained.',
    articleCount: 21,
    kind: 'feature',
    groups: ['Everyday Elements', 'Page Blocks', 'Palette Settings'],
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Work with what is on your pages: place, select, link, layer, rotate, animate, lock and theme elements, undo changes, and start from templates.',
    articleCount: 20,
    kind: 'feature',
    groups: ['Basics', 'Text and Notes', 'Styling Elements', 'Layers and Locking'],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one document: organise, link, and move between tabs of pages.',
    articleCount: 10,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, teams and sharing.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: find and replace, zen mode, light and dark mode, Markdown import, and cleanup.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any document, folder, team, tab, or element, and add new elements to the canvas.',
    articleCount: 1,
    kind: 'feature',
  },
];

export const articles: Article[] = [
  // ---- About ----
  {
    slug: 'what-is-livedocuments',
    title: 'What is livedocuments?',
    description:
      'An overview of the real-time, multiplayer editor for articles, decks, infographics and flashcards.',
    keywords:
      'overview intro introduction about product articles slides deck infographics flashcards presenting app',
    category: 'About livedocuments',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livedocuments'],
  },
  {
    slug: 'why-livedocuments',
    title: 'Why Use livedocuments?',
    description: 'Free, open source, no sign-in wall, real-time collaboration. Here is why.',
    keywords: 'benefits reasons comparison alternatives features advantages',
    category: 'About livedocuments',
    categorySlug: 'about',
    parentSlug: 'about',
    apps: ['livedocuments'],
  },
  // ---- Getting Started ----
  {
    slug: 'your-first-document',
    title: 'Your First Document',
    description: 'From a new document to a first page you can share, in a couple of minutes.',
    keywords:
      'start begin new create tutorial beginner basics quickstart onboarding document page article slide picture template location',
    category: 'Getting Started',
    categorySlug: 'getting-started',
    apps: ['livedocuments'],
  },
  {
    slug: 'exporting-documents',
    title: 'Exporting Documents',
    description:
      'Take your pages with you as a PDF, images, a GIF, PowerPoint, Word, Markdown or a portable file, download everything as one zip, or embed a live view.',
    keywords:
      'export download png svg pdf gif animated image save picture screenshot json embed backup powerpoint pptx word docx markdown md print zip download all my data your data takeout gdpr portability team data',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
    apps: ['livedocuments'],
  },
  {
    slug: 'images-and-pages',
    title: 'Images, Pages and More',
    description: 'API examples for images, pages and articles, renders and copies.',
    keywords:
      'images upload pages page slides article articles markdown render svg picture copy duplicate api',
    category: 'Developers',
    categorySlug: 'developers/working-with-documents',
    parentSlug: 'working-with-documents',
    apps: ['livedocuments'],
  },
  {
    slug: 'slide-builds',
    title: 'Builds',
    description: "Reveal a slide's points one click at a time while you present.",
    keywords:
      'build builds animate animation reveal one at a time click to reveal step steps bullet points appear fade rise order sequence entrance progressive disclosure keynote powerpoint animations present presenting next back badge number',
    category: 'Selection Modes',
    categorySlug: 'selection-modes/slide-deck',
    parentSlug: 'slide-deck',
    apps: ['livedocuments'],
  },
  {
    slug: 'infographic-layouts',
    title: 'Infographic Layouts',
    description:
      'Ninety-two ready-made pages in eight categories, previewed on your page as you hover.',
    keywords:
      'layout layouts template templates page template start from a layout ready made starter preview hover replace title page big number key stats statistics process steps timeline milestones comparison before after chart story top tips quote testimonial team people facts grid checklist event invitation poster layout button replace undo covers posters data explainers cover report cover annual report magazine book cover proposal case study newsletter contents certificate award gig concert research poster academic coming soon movie film exhibition travel workshop hiring job sale discount notice warning motivational kpi dashboard metrics trend market share pie doughnut stat mosaic staircase customer journey project plan gantt decision flow flowchart how-to recipe versus vs pricing price plans tiers swot effort impact matrix quadrant scorecard rating spectrum venn options org chart organisation organization testimonials reviews speakers spotlight employee values idea board brainstorm persona user persona shout-outs kudos thank you social media carousel instagram tip of the day milestone followers behind the scenes countdown product launch giveaway contest welcome onboarding webinar how it works anatomy diagram key concepts cheat sheet shortcuts glossary definitions myths facts fact file lesson summary quiz formula equation explainer education',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
    apps: ['livedocuments'],
  },
  {
    slug: 'articles',
    title: 'Writing Articles',
    description:
      'Write on pages like a doc: text that flows onto new pages, with pictures, charts and drawings in it.',
    keywords:
      'article articles write writing document doc word google docs page pages text paragraph heading headings title subtitle list bullet numbered todo checklist quote code divider page break flow overflow new page toolbar formatting bold italic underline link colour color highlight align markdown shortcut slash menu paste picture image chart table sticky drawing inline wrap float move drag resize comment comments action actions assign margin note style look font fonts margins page numbers line spacing lined paper notebook convert page element leave pages',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
    apps: ['livedocuments'],
  },
  {
    slug: 'flashcards',
    title: 'Flashcards',
    description: 'A stack of small text cards to speak from, flipped one at a time.',
    keywords:
      'flashcard flashcards flash card cards cue card cue cards note cards index card speaker notes speech talk toast pitch presentation stack flip flipping card number speaking time reading time words per minute too long split onto a new card text only blank flashcards conference talk wedding toast product pitch',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
    apps: ['livedocuments'],
  },
  {
    slug: 'slide-pages',
    title: 'Slide Pages',
    description:
      'Landscape 16:9 or 4:3 pages with 64 slide layouts, each in the deck from the moment you make it.',
    keywords:
      'slide slides deck presentation present powerpoint keynote 16:9 4:3 widescreen classic landscape layouts title slide bullets agenda thank you add to slide deck hide show eye presenter',
    category: 'Pages',
    categorySlug: 'pages',
    group: 'Kinds of Page',
    apps: ['livedocuments'],
  },
  {
    slug: 'version-history',
    title: 'Version History',
    description:
      "Look back through a tab's earlier versions, see what changed, and restore one or copy it.",
    keywords:
      'history versions version restore revert undo go back earlier previous older recover rollback roll back snapshot backup named copy',
    category: 'Tabs',
    categorySlug: 'tabs',
    apps: ['livedocuments'],
  },
  {
    slug: 'start-a-project',
    title: 'Starting a Project From a Kit',
    description:
      'One press makes every file a project needs, in every app, in a new folder, all connected.',
    keywords:
      'start a project kit kits template templates project setup software project product launch team workshop website build connected files folder all apps one click',
    category: 'Explorer',
    categorySlug: 'explorer',
    group: 'Your Library',
    apps: ['livedocuments'],
  },
  {
    slug: 'find-and-replace',
    title: 'Find and Replace',
    description:
      'Find a word on every page of the tab, step through the matches, and replace one or all of them.',
    keywords:
      'find replace search find in tab find and replace replace all match case whole word ctrl f cmd f command f ctrl shift h search and replace look for word phrase text highlight matches next previous count change every rename',
    category: 'Tools',
    categorySlug: 'tools',
    apps: ['livedocuments'],
  },
  // ---- Sub-articles: Writing Articles ----
  {
    slug: 'article-tables',
    title: 'Tables in Articles',
    description:
      'A table in the writing: Tab through its cells, add rows and columns, and repeat its header row on every page.',
    keywords:
      'table tables article writing rows columns row column cell cells grid spreadsheet header row repeat repeated insert row above below insert column left right delete row delete column delete table resize column width tab paste google sheets excel numbers word google docs markdown pipe table tab separated split across pages',
    category: 'Pages',
    categorySlug: 'pages/articles',
    parentSlug: 'articles',
    apps: ['livedocuments'],
  },
  {
    slug: 'contents-headers-footers',
    title: 'Contents, Headers and Footers',
    description:
      'A table of contents that lists your headings with their pages, and a header and footer on every page.',
    keywords:
      'table of contents toc contents index headings outline page numbers page number page count document name date header footer running header running footer different first page title page leader dotted jump link pdf word h1 h2 h3 depth style',
    category: 'Pages',
    categorySlug: 'pages/articles',
    parentSlug: 'articles',
    apps: ['livedocuments'],
  },
  {
    slug: 'maps',
    title: 'Maps',
    description: 'A world, region or country map with highlighted countries and pinned places.',
    keywords:
      'map world globe country countries region geography atlas pin pins marker location city cities office offices markets europe',
    category: 'Palette',
    categorySlug: 'palette/tools',
    parentSlug: 'tools',
    apps: ['livedocuments'],
  },
];
