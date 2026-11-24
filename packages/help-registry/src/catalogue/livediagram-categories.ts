// The livediagram help catalogue's categories (docs/specs/017-help/help-centre.md); its articles are in ./livediagram.ts.

import type { Category } from '../types';

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livediagram',
    description:
      'Get to know livediagram: what it is, who it helps, and the ideas behind a free, open canvas.',
    articleCount: 4,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from a blank canvas to a shared diagram in minutes, with the basics every new user needs.',
    articleCount: 8,
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
      'Stay in control of your work: how guest access, signing in, syncing, exporting, deletion, API tokens, connecting AI tools, the Google Drive mirror, and email notifications work.',
    articleCount: 11,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your canvases are stored, what we collect, and how to keep shared links safe.',
    articleCount: 5,
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call the livediagram REST API from your own scripts or the command line: authentication, worked examples, the CLI, repositories and developer tools, errors and limits, and the OpenAPI reference.',
    articleCount: 9,
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
      'How livediagram works on a computer, a tablet, and a phone, and what to expect on each.',
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
      'Organise everything you build: how the Explorer keeps your canvases, folders, teams, and assets easy to find and manage.',
    articleCount: 16,
    kind: 'feature',
    groups: ['Your Library', 'Activity', 'Assets and Imports'],
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette (Select, Hand, Eraser, Format Painter, Laser, Spotlight and Isometric), and the Slide Deck, opened from Tools.',
    articleCount: 8,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything on the canvas: every element and palette setting explained.',
    articleCount: 34,
    kind: 'feature',
    groups: ['Everyday Elements', 'Diagram Kits', 'Workshop Kits', 'Palette Settings'],
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Master the infinite canvas: place, select, link, annotate, layer, rotate, animate, lock and theme elements, undo changes, and start from templates.',
    articleCount: 29,
    kind: 'feature',
    groups: [
      'Basics',
      'Modes and Boards',
      'Text and Notes',
      'Styling Elements',
      'Layers and Locking',
    ],
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole project in one canvas: organise, link, and move between multiple boards with tabs.',
    articleCount: 10,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, teams, sharing, and session tools.',
    articleCount: 11,
    kind: 'feature',
    groups: ['Working Together', 'Other Apps', 'Running Sessions'],
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: automations, zen mode, light and dark mode, Markdown import, and cleanup.',
    articleCount: 4,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any canvas, folder, team, tab, or element, and add new elements to the canvas.',
    articleCount: 1,
    kind: 'feature',
  },
];
