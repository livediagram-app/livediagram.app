// All Apps' categories (liveworkspace/docs/specs/017-help/help-centre.md "The All Apps home"): the title and
// description www.liveworkspace.app/help gives each category, in the order its pages list them. The categories
// themselves, their kinds and groups, are the apps' (each app's catalogue file); this names them for every app at
// once, where an app's own copy speaks of its own work ("About livediagram", "your canvases"). A category not listed
// here keeps the first app's copy, after these.

import type { AllAppsCategory } from '../scope';

export const ALL_APPS_CATEGORIES: readonly AllAppsCategory[] = [
  {
    slug: 'about',
    title: 'About the Apps',
    description:
      'Get to know the liveworkspace apps: what each one is for, who they help, and the ideas behind free, open tools with no trackers.',
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description:
      'Go from your first file to sharing it with your team in minutes, with the basics every new user needs in any app.',
  },
  {
    slug: 'tips-and-tricks',
    title: 'Tips and Tricks',
    description:
      'Work faster with the shortcuts, hidden features, and small habits experienced users rely on.',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description:
      'Work together in real time: comments, assigned actions, live presence, teams, sharing, and session tools.',
  },
  {
    slug: 'explorer',
    title: 'Explorer',
    description:
      'Organise everything you build: one library, shared by every liveworkspace app, that keeps your files, folders, teams and assets easy to find.',
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description:
      'Keep a whole piece of work in one file: organise, link, and move between its tabs, and connect tabs across apps.',
  },
  {
    slug: 'user-interface',
    title: 'User Interface',
    description:
      'Get your bearings in the editors: the panels, toolbar, context menus, the Map, zoom and tab bars, settings and quick controls.',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description:
      'Do more with less effort using the editor helpers: zen mode, light and dark mode, and cleanup.',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description:
      'Find anything in seconds: jump to any file, folder, team, tab or element, and run commands.',
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description:
      'Work with what is on the canvas or the page: place, select, link, layer, rotate, animate, lock and theme elements, and undo changes.',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description:
      'Your launchpad for everything you add: every element and palette setting explained, app by app.',
  },
  {
    slug: 'selection-modes',
    title: 'Selection Modes',
    description:
      'The pointer modes at the top of the palette: Select, Hand, Eraser, Format Painter, Laser and Spotlight, and where each app adds its own.',
  },
  {
    slug: 'account-and-data',
    title: 'Account and Data',
    description:
      'Stay in control of your work: one liveworkspace account for every app, guest access, signing in, syncing, exporting, deletion, API tokens, connecting AI tools and the Google Drive mirror.',
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description:
      'Know exactly how your work is stored, what we collect, and how to keep shared links safe, in every app.',
  },
  {
    slug: 'supported-devices',
    title: 'Supported Devices',
    description:
      'How the apps work on a computer, a tablet, and a phone, and what to expect on each.',
  },
  {
    slug: 'developers',
    title: 'Developers',
    description:
      'Call each app’s REST API from your own scripts or the command line: authentication, worked examples, the CLIs, errors and limits, and the OpenAPI references.',
  },
  {
    slug: 'policies',
    title: 'Policies',
    description:
      "How to report a vulnerability. The terms and privacy policy are liveworkspace's, on liveworkspace.app.",
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description:
      'Get unstuck fast with fixes for the most common editor, sign-in and collaboration problems.',
  },
  {
    slug: 'contact',
    title: 'Contact',
    description: 'Get in touch, report a bug, or request a feature.',
  },
];
