export interface Article {
  slug: string;
  title: string;
  description: string;
  category: string;
  /** Full nested path under /help, e.g. "canvas" or "canvas/the-canvas". */
  categorySlug: string;
  /** Feature-landing slug this article hangs off, if it's a sub-article. */
  parentSlug?: string;
}

/**
 * Canonical in-app path to an article page. Trailing slash to match the help
 * app's `trailingSlash: true` (so internal links resolve directly instead of
 * 308-redirecting). `next/link` prepends the `/help` basePath at render; the
 * sitemap, which needs absolute URLs, prepends the origin + `/help` itself.
 * One source for the `/<categorySlug>/<slug>/` shape every card / list / sitemap
 * entry was spelling out by hand.
 */
export function articleHref(article: Pick<Article, 'categorySlug' | 'slug'>): string {
  return `/${article.categorySlug}/${article.slug}/`;
}

/**
 * Canonical in-app path to a category landing page (`/<slug>/`, trailing slash
 * to match `trailingSlash: true`). `slug` is a category slug — top-level
 * (`canvas`) or a nested feature path (`canvas/the-canvas`), both of
 * which have a landing page. Sibling of {@link articleHref}; one source for the
 * category-link shape the cards / breadcrumbs / sitemap built by hand.
 */
export function categoryHref(slug: string): string {
  return `/${slug}/`;
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  articleCount: number;
  /** Feature-guide categories: grouped under "Feature Guides" on the home page,
   *  apart from the support categories (About, Getting Started, ...). */
  kind?: 'feature';
}

export const categories: Category[] = [
  {
    slug: 'about',
    title: 'About livediagram',
    description: 'What livediagram is, who it is for, and why it exists.',
    articleCount: 3,
  },
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'New here? Create your first diagram and learn the basics.',
    articleCount: 6,
  },
  {
    slug: 'tips-and-tricks',
    title: 'Tips and Tricks',
    description: 'Shortcuts and lesser-known features to work faster.',
    articleCount: 5,
  },
  {
    slug: 'account-and-data',
    title: 'Account and Data',
    description: 'Guest access, signing in, syncing, exporting, and deleting data.',
    articleCount: 4,
  },
  {
    slug: 'privacy-and-security',
    title: 'Privacy and Security',
    description: 'How your data is handled, what we collect, and link protection.',
    articleCount: 4,
  },
  {
    slug: 'self-hosting',
    title: 'Self-Hosting',
    description: 'Run your own livediagram instance. It is open source and free.',
    articleCount: 3,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Fixes for common problems with the editor and collaboration.',
    articleCount: 5,
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
  // sub-guides). See spec/55.
  {
    slug: 'explorer',
    title: 'Explorer',
    description: 'Recent, Shared, My Work, Teams, the image gallery, and saved themes.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'palette',
    title: 'Palette',
    description: 'Add shapes, arrows, drawings, images, icons, and data elements.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'canvas',
    title: 'Canvas',
    description: 'Place, select, group, link, and annotate on the infinite canvas.',
    articleCount: 4,
    kind: 'feature',
  },
  {
    slug: 'tabs',
    title: 'Tabs',
    description: 'Multiple boards per diagram: folders, links, import/export, and cleanup.',
    articleCount: 7,
    kind: 'feature',
  },
  {
    slug: 'customisation',
    title: 'Customisation',
    description: 'Themes, templates, fonts, style presets, and isometric views.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'collaboration',
    title: 'Collaboration',
    description: 'Comments, teams, sharing, history, and live session tools.',
    articleCount: 5,
    kind: 'feature',
  },
  {
    slug: 'tools',
    title: 'Tools',
    description: 'AI assistance, zen mode, Markdown import, and layout cleanup.',
    articleCount: 4,
    kind: 'feature',
  },
  {
    slug: 'search-panel',
    title: 'Search Panel',
    description: 'Jump to any diagram, folder, team, tab, or element, and add to the canvas.',
    articleCount: 1,
    kind: 'feature',
  },
];

// The two ways the category list partitions by `kind`, derived once here so the
// home + features pages don't each re-spell the predicate. Feature-guide
// categories (the card grids), and the support categories (About, Getting
// Started, ...) minus Contact, which the home renders as its own CTA.
export const featureCategories: Category[] = categories.filter((c) => c.kind === 'feature');
export const supportCategories: Category[] = categories.filter(
  (c) => c.kind !== 'feature' && c.slug !== 'contact',
);

export const articles: Article[] = [
  // ---- About ----
  {
    slug: 'what-is-livediagram',
    title: 'What is livediagram?',
    description: 'An overview of the real-time, multiplayer diagram editor and what it does.',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'who-is-it-for',
    title: 'Who is livediagram For?',
    description: 'The teams and use cases that get the most out of livediagram.',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
  },
  {
    slug: 'why-livediagram',
    title: 'Why Use livediagram?',
    description: 'Free, open source, no sign-in wall, real-time collaboration. Here is why.',
    category: 'About livediagram',
    categorySlug: 'about',
    parentSlug: 'about',
  },

  // ---- Getting Started ----
  {
    slug: 'your-first-diagram',
    title: 'Your First Diagram',
    description: 'Create a diagram and add your first shapes in under a minute.',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'the-canvas-basics',
    title: 'Canvas Basics',
    description: 'Panning, zooming, and finding your way around the editor.',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'adding-shapes-and-arrows',
    title: 'Adding Shapes and Arrows',
    description: 'Use the palette and quick-connect to build out a diagram.',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'sharing-your-diagram',
    title: 'Sharing Your Diagram',
    description: 'Hand a link to anyone and edit together in real time.',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'guest-vs-account',
    title: 'Guest vs Account',
    description: 'The canvas works without signing in. Here is what an account adds.',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },
  {
    slug: 'keyboard-essentials',
    title: 'Keyboard Essentials',
    description: 'The handful of shortcuts that make editing fast.',
    category: 'Getting Started',
    categorySlug: 'getting-started',
  },

  // ---- Tips and Tricks ----
  {
    slug: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'The full shortcut reference and how to toggle shortcuts off.',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'command-palette',
    title: 'The Command Palette',
    description: 'Add any shape or run any command from the floating palette.',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'format-painter',
    title: 'The Format Painter',
    description: 'Copy the look of one element onto others in two clicks.',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'fast-theming',
    title: 'Theme a Diagram Fast',
    description: 'Restyle an entire diagram in seconds with themes and presets.',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },
  {
    slug: 'presenting-well',
    title: 'Presenting from the Canvas',
    description: 'Get the most out of Presentation mode and Zen mode.',
    category: 'Tips and Tricks',
    categorySlug: 'tips-and-tricks',
  },

  // ---- Account and Data ----
  {
    slug: 'guest-identity',
    title: 'How Guest Identity Works',
    description: 'The per-browser id that owns your diagrams when you are not signed in.',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'signing-in',
    title: 'Signing In',
    description: 'Create an account, sign in, and migrate your guest diagrams.',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'exporting-diagrams',
    title: 'Exporting Diagrams',
    description: 'Get a diagram out as an image or a shareable embed.',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },
  {
    slug: 'deleting-your-data',
    title: 'Deleting Your Data',
    description: 'How to remove a diagram or clear everything tied to your id.',
    category: 'Account and Data',
    categorySlug: 'account-and-data',
  },

  // ---- Privacy and Security ----
  {
    slug: 'data-privacy',
    title: 'Data Privacy',
    description: 'Where your diagrams live and how they are handled.',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'what-we-collect',
    title: 'What We Collect',
    description: 'The anonymous, first-party telemetry we record, and how to opt out.',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'share-link-security',
    title: 'Share Link Security',
    description: 'Passwords and expiry for the links you hand out.',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },
  {
    slug: 'open-source-trust',
    title: 'Open Source and Trust',
    description: 'The code is public and MIT-licensed. What that means for you.',
    category: 'Privacy and Security',
    categorySlug: 'privacy-and-security',
    parentSlug: 'privacy-and-security',
  },

  // ---- Self-Hosting ----
  {
    slug: 'self-hosting-overview',
    title: 'Self-Hosting Overview',
    description: 'What it takes to run your own livediagram, and why you might.',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },
  {
    slug: 'deploying-livediagram',
    title: 'Deploying livediagram',
    description: 'The apps, the Cloudflare stack, and how a deploy runs.',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },
  {
    slug: 'configuration',
    title: 'Configuration and Optional Auth',
    description: 'Environment variables, optional Clerk auth, and guest-only mode.',
    category: 'Self-Hosting',
    categorySlug: 'self-hosting',
    parentSlug: 'self-hosting',
  },

  // ---- Troubleshooting ----
  {
    slug: 'diagram-not-loading',
    title: 'A Diagram Will Not Load',
    description: 'What to check when a diagram is blank or stuck loading.',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'cannot-sign-in',
    title: 'Cannot Sign In',
    description: 'Steps to take if sign-in fails or you lose access.',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'collaboration-issues',
    title: 'Real-Time Collaboration Problems',
    description: 'Cursors, edits, or presence not syncing? Try these.',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'browser-compatibility',
    title: 'Browser Compatibility',
    description: 'Supported browsers and how to fix rendering glitches.',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },
  {
    slug: 'missing-changes',
    title: 'My Changes Are Missing',
    description: 'How autosave works and how to recover with history.',
    category: 'Troubleshooting',
    categorySlug: 'troubleshooting',
  },

  // ============ Features (landing pages) ============
  {
    slug: 'the-canvas',
    title: 'The Canvas',
    description: 'The infinite canvas, the palette, and adding elements.',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'shapes-and-arrows',
    title: 'Shapes and Arrows',
    description: 'Every shape and arrow style, with draggable curve and elbow handles.',
    category: 'Palette',
    categorySlug: 'palette',
  },
  {
    slug: 'drawing',
    title: 'Drawing and Sketch',
    description: 'Freehand drawing with the Pencil, plus shape recognition.',
    category: 'Palette',
    categorySlug: 'palette',
  },
  {
    slug: 'selecting-and-grouping',
    title: 'Selecting and Grouping',
    description: 'Marquee, multi-select, groups, and the format painter.',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'text-and-fonts',
    title: 'Text and Fonts',
    description: 'Editing labels and choosing from eight fonts per element or tab.',
    category: 'Customisation',
    categorySlug: 'customisation',
  },
  {
    slug: 'themes',
    title: 'Themes',
    description: 'Restyle a whole diagram, including multi-colour and custom themes.',
    category: 'Customisation',
    categorySlug: 'customisation',
  },
  {
    slug: 'templates',
    title: 'Templates',
    description: 'Start from a themed template instead of a blank canvas.',
    category: 'Customisation',
    categorySlug: 'customisation',
  },
  {
    slug: 'using-tabs',
    title: 'Tabs',
    description: 'Multiple boards in one diagram: add, name, reorder, and switch between them.',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'tab-folders',
    title: 'Tab Folders',
    description: 'Group related tabs under a named, collapsible folder along the tab bar.',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'linking-tabs',
    title: 'Linking Across Tabs',
    description: 'Turn an element into a jump point to another tab, element, diagram, or URL.',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'add-to-diagram',
    title: 'Add a Tab to Another Diagram',
    description: 'Copy the active tab into another diagram you own from the tab menu.',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'import-tabs',
    title: 'Importing a Tab',
    description: 'Import a JSON or Markdown file into the active tab (it replaces the contents).',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'export-tabs',
    title: 'Exporting a Tab',
    description: 'Export the active tab as PNG, SVG, PDF, Markdown, or a livediagram JSON file.',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'tab-cleanup',
    title: 'Cleaning Up a Tab',
    description: 'Tidy a tab in one click: snap to a grid, or auto-lay-out from the arrows.',
    category: 'Tabs',
    categorySlug: 'tabs',
  },
  {
    slug: 'comments',
    title: 'Comments',
    description: 'Leave threaded comments on the canvas and resolve them.',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'links',
    title: 'Links and Link Cards',
    description: 'Link elements across tabs or to URLs, and bookmark cards.',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'images',
    title: 'Images',
    description: 'Add images to the canvas from your per-owner gallery.',
    category: 'Palette',
    categorySlug: 'palette',
  },
  {
    slug: 'the-explorer',
    title: 'The Explorer',
    description: 'How the Explorer is laid out: the sidebar sections, list view, and folders.',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'recent',
    title: 'Recent Diagrams',
    description: 'The default view: the diagrams you opened or edited most recently.',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'shared-with-you',
    title: 'Shared With You',
    description: 'Diagrams other people have shared with you, collected in one place.',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'my-work',
    title: 'My Work and Folders',
    description: 'Your own library: the Unsorted bucket and the nested folders you create.',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'team-spaces',
    title: 'Team Spaces',
    description: 'The teams you belong to, their shared folders, and your pending invites.',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'image-gallery',
    title: 'Image Gallery',
    description: 'Every image you have uploaded, with where each is used and how to delete them.',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'themes-library',
    title: 'Saved Themes',
    description: 'Your custom themes as swatch previews, ready to edit, duplicate, or reuse.',
    category: 'Explorer',
    categorySlug: 'explorer',
  },
  {
    slug: 'teams',
    title: 'Teams',
    description: 'Invite members, assign roles, and share diagrams across a team.',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'sharing',
    title: 'Sharing and Embeds',
    description: 'Share links, passwords, expiry, read-only embeds, and live images.',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'zen-mode',
    title: 'Zen Mode',
    description: 'A distraction-free canvas with all the chrome hidden.',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'ai',
    title: 'AI Assistance',
    description: 'Optional Build, Clean, Ask, and Review helpers on the canvas.',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'markdown-import',
    title: 'Markdown Import',
    description: 'Turn a Markdown outline into a themed tree diagram.',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'history',
    title: 'Activity and History',
    description: 'The per-diagram change log, Activity Panel, and surgical revert.',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'session-tools',
    title: 'Session Tools',
    description: 'A shared countdown or stopwatch and live dot-voting.',
    category: 'Collaboration',
    categorySlug: 'collaboration',
  },
  {
    slug: 'data-elements',
    title: 'Data and Chart Elements',
    description: 'Progress bars, ratings, pie charts, and timeline rails.',
    category: 'Palette',
    categorySlug: 'palette',
  },
  {
    slug: 'style-presets',
    title: 'Style Presets',
    description: 'One-click colour and line-style variations for shapes and arrows.',
    category: 'Customisation',
    categorySlug: 'customisation',
  },
  {
    slug: 'layout-cleanup',
    title: 'Layout Cleanup',
    description: 'Auto-align to a grid or auto-layout the whole diagram.',
    category: 'Tools',
    categorySlug: 'tools',
  },
  {
    slug: 'isometric',
    title: 'Isometric View',
    description: 'Tilt a tab into an extruded, isometric perspective.',
    category: 'Customisation',
    categorySlug: 'customisation',
  },
  {
    slug: 'annotations',
    title: 'Annotations',
    description: 'Drop a marker with a note that readers hover to read.',
    category: 'Canvas',
    categorySlug: 'canvas',
  },
  {
    slug: 'technology-icons',
    title: 'Technology Icons',
    description: 'Full-colour AWS, Azure, and infra icons for architecture diagrams.',
    category: 'Palette',
    categorySlug: 'palette',
  },

  // ---- Sub-articles: Canvas ----
  {
    slug: 'adding-elements',
    title: 'Adding Elements',
    description: 'Use the command palette and double-click to place shapes.',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },
  {
    slug: 'pan-and-zoom',
    title: 'Panning and Zooming',
    description: 'Move around the infinite canvas and fit the view.',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },
  {
    slug: 'changing-the-background',
    title: 'Changing the Canvas Background',
    description: 'Pick a canvas background from the Change Canvas dialog.',
    category: 'Canvas',
    categorySlug: 'canvas/the-canvas',
    parentSlug: 'the-canvas',
  },

  // ---- Sub-articles: Shapes and Arrows ----
  {
    slug: 'arrow-styles',
    title: 'Arrow Styles',
    description: 'Straight, curved, and elbow arrows and how to switch between them.',
    category: 'Palette',
    categorySlug: 'palette/shapes-and-arrows',
    parentSlug: 'shapes-and-arrows',
  },
  {
    slug: 'curve-and-elbow-handles',
    title: 'Curve and Elbow Handles',
    description: 'Drag the handles to shape an arrow exactly how you want.',
    category: 'Palette',
    categorySlug: 'palette/shapes-and-arrows',
    parentSlug: 'shapes-and-arrows',
  },
  {
    slug: 'arrow-to-arrow',
    title: 'Connecting Arrows to Arrows',
    description: 'Snap an arrow endpoint onto another arrow for sequence diagrams.',
    category: 'Palette',
    categorySlug: 'palette/shapes-and-arrows',
    parentSlug: 'shapes-and-arrows',
  },
  {
    slug: 'shape-markers',
    title: 'Shape Markers',
    description: 'Traffic-light dots and a checkbox glyph inside a shape.',
    category: 'Palette',
    categorySlug: 'palette/shapes-and-arrows',
    parentSlug: 'shapes-and-arrows',
  },

  // ---- Sub-articles: Drawing ----
  {
    slug: 'shape-recognition',
    title: 'Shape Recognition',
    description: 'Let the Pencil snap rough sketches into clean shapes.',
    category: 'Palette',
    categorySlug: 'palette/drawing',
    parentSlug: 'drawing',
  },

  // ---- Sub-articles: Selecting and Grouping ----
  {
    slug: 'multi-select',
    title: 'Marquee and Multi-Select',
    description: 'Select many elements at once and act on them together.',
    category: 'Canvas',
    categorySlug: 'canvas/selecting-and-grouping',
    parentSlug: 'selecting-and-grouping',
  },
  {
    slug: 'groups',
    title: 'Groups',
    description: 'Bind elements into a group that moves and styles as one.',
    category: 'Canvas',
    categorySlug: 'canvas/selecting-and-grouping',
    parentSlug: 'selecting-and-grouping',
  },
  {
    slug: 'using-the-format-painter',
    title: 'Using the Format Painter',
    description: 'Copy one element’s style onto others.',
    category: 'Canvas',
    categorySlug: 'canvas/selecting-and-grouping',
    parentSlug: 'selecting-and-grouping',
  },

  // ---- Sub-articles: Text and Fonts ----
  {
    slug: 'choosing-fonts',
    title: 'Choosing Fonts',
    description: 'Set a font per element or a default font for the whole tab.',
    category: 'Customisation',
    categorySlug: 'customisation/text-and-fonts',
    parentSlug: 'text-and-fonts',
  },

  // ---- Sub-articles: Themes ----
  {
    slug: 'changing-theme',
    title: 'Changing the Theme',
    description: 'Open the theme dialog and browse themes by category.',
    category: 'Customisation',
    categorySlug: 'customisation/themes',
    parentSlug: 'themes',
  },
  {
    slug: 'multicolour-themes',
    title: 'Multi-Colour Themes',
    description: 'Tint each branch of a hierarchy its own hue.',
    category: 'Customisation',
    categorySlug: 'customisation/themes',
    parentSlug: 'themes',
  },
  {
    slug: 'custom-themes',
    title: 'Custom Themes',
    description: 'Build, save, and reuse your own themes.',
    category: 'Customisation',
    categorySlug: 'customisation/themes',
    parentSlug: 'themes',
  },

  // ---- Sub-articles: Links ----
  {
    slug: 'link-cards',
    title: 'Link Cards',
    description: 'Bookmark a URL as a card with title, favicon, and preview.',
    category: 'Canvas',
    categorySlug: 'canvas/links',
    parentSlug: 'links',
  },

  // ---- Sub-articles: Teams ----
  {
    slug: 'roles-and-invites',
    title: 'Roles and Invites',
    description: 'Admin and Member roles, and inviting people by email.',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
  },
  {
    slug: 'team-shared-diagrams',
    title: 'Team Shared Diagrams',
    description: 'A per-team folder tree every member can manage.',
    category: 'Collaboration',
    categorySlug: 'collaboration/teams',
    parentSlug: 'teams',
  },

  // ---- Sub-articles: Sharing ----
  {
    slug: 'share-passwords',
    title: 'Share Passwords',
    description: 'Gate view or edit access behind a password.',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'share-link-expiry',
    title: 'Share Link Expiry',
    description: 'Give a share link a lifetime so it stops working later.',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },
  {
    slug: 'embeds',
    title: 'Read-Only Embeds',
    description: 'Drop a live, read-only diagram into another page.',
    category: 'Collaboration',
    categorySlug: 'collaboration/sharing',
    parentSlug: 'sharing',
  },

  // ---- Sub-articles: AI ----
  {
    slug: 'ai-tools',
    title: 'Build, Clean, Ask, and Review',
    description: 'What each AI helper does and when to reach for it.',
    category: 'Tools',
    categorySlug: 'tools/ai',
    parentSlug: 'ai',
  },

  // ---- Sub-articles: History ----
  {
    slug: 'activity-panel',
    title: 'The Activity Panel',
    description: 'Read the per-diagram change log as it happens.',
    category: 'Collaboration',
    categorySlug: 'collaboration/history',
    parentSlug: 'history',
  },
  {
    slug: 'reverting-changes',
    title: 'Reverting Changes',
    description: 'Undo a specific past change without losing the rest.',
    category: 'Collaboration',
    categorySlug: 'collaboration/history',
    parentSlug: 'history',
  },

  // ---- Sub-articles: Session Tools ----
  {
    slug: 'timer',
    title: 'The Timer',
    description: 'Run a shared countdown or stopwatch on a tab.',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
  },
  {
    slug: 'voting',
    title: 'Dot Voting',
    description: 'Let everyone vote live and tally the results.',
    category: 'Collaboration',
    categorySlug: 'collaboration/session-tools',
    parentSlug: 'session-tools',
  },

  // ---- Sub-articles: Data Elements ----
  {
    slug: 'progress-elements',
    title: 'Progress Bars and Rings',
    description: 'Show a 0–100% value with fill animations.',
    category: 'Palette',
    categorySlug: 'palette/data-elements',
    parentSlug: 'data-elements',
  },
  {
    slug: 'rating',
    title: 'Rating',
    description: 'A 1–5 star rating element with a score picker.',
    category: 'Palette',
    categorySlug: 'palette/data-elements',
    parentSlug: 'data-elements',
  },
  {
    slug: 'pie-chart',
    title: 'Pie Chart',
    description: 'An editable pie chart built from label and value rows.',
    category: 'Palette',
    categorySlug: 'palette/data-elements',
    parentSlug: 'data-elements',
  },

  // ---- Sub-articles: Layout Cleanup ----
  {
    slug: 'auto-align',
    title: 'Auto-Align',
    description: 'Snap selected elements onto a tidy grid.',
    category: 'Tools',
    categorySlug: 'tools/layout-cleanup',
    parentSlug: 'layout-cleanup',
  },
  {
    slug: 'auto-layout',
    title: 'Auto Layout',
    description: 'Recompute positions from the arrow graph with Tidy Up.',
    category: 'Tools',
    categorySlug: 'tools/layout-cleanup',
    parentSlug: 'layout-cleanup',
  },

  // ============ Search Panel (landing + sub-articles) ============
  {
    slug: 'the-search-panel',
    title: 'The Search Panel',
    description: 'Open the global search, what it covers, and how to navigate the results.',
    category: 'Search Panel',
    categorySlug: 'search-panel',
  },
  {
    slug: 'search-diagrams',
    title: 'Finding Diagrams and Folders',
    description: 'Search across your diagrams, folders, and the diagrams shared with you.',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-teams',
    title: 'Searching Teams',
    description: 'Find teams and their shared folders and diagrams from the search panel.',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-tabs-and-elements',
    title: 'Finding Tabs and Elements',
    description: 'Inside a diagram, jump to any tab or element, including text inside table cells.',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-add-to-canvas',
    title: 'Adding Elements from Search',
    description:
      'Search the palette and drop a shape or icon onto the canvas without leaving search.',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
  {
    slug: 'search-create-tab',
    title: 'Creating a Tab from Search',
    description: 'Spin up a new tab straight from the search panel with the Create new tab action.',
    category: 'Search Panel',
    categorySlug: 'search-panel/the-search-panel',
    parentSlug: 'the-search-panel',
  },
];

export function getArticlesByCategory(categorySlug: string): Article[] {
  return articles.filter((a) => a.categorySlug === categorySlug);
}

export function getSubArticles(parentSlug: string): Article[] {
  return articles.filter((a) => a.parentSlug === parentSlug);
}

export function searchArticles(query: string): Article[] {
  const lower = query.toLowerCase();
  return articles.filter(
    (a) => a.title.toLowerCase().includes(lower) || a.description.toLowerCase().includes(lower),
  );
}
