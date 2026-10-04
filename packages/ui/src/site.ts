import type { Metadata, Viewport } from 'next';

// The site-wide constants every public frontend shares. Before this each app
// kept its own copy (marketing and help had a `lib/site.ts` apiece, telemetry
// inlined the origin, the ShareRail and the editor's GitHub link hardcoded
// theirs), so the origin and the repo URL lived in five places.

// The canonical origin. livediagram.app is one origin: the router stitches
// the apps together by path (docs/specs/016-platform/router-app.md), so every app's metadataBase, JSON-LD
// ids and share links resolve against this one value (docs/specs/019-marketing/marketing-site.md "SEO and
// metadata").
export const SITE_URL = 'https://livediagram.app';

// The product / site name: the metadata siteName and the JSON-LD name.
export const SITE_NAME = 'livediagram';

// What livediagram is, in the words every public surface uses (docs/specs/019-marketing/marketing-site.md
// "SEO and metadata"), kept here so they can't drift: the landing page's title, its description
// (also the web app manifest's), and the one-line pitch the share card, the share images' alt text
// and the share rail build on. It names every kind of thing the canvas makes, not just diagrams.
export const SITE_TITLE = 'livediagram: Diagram, draw and illustrate together, live';
export const SITE_DESCRIPTION =
  'A free, real-time canvas for diagrams, whiteboards, mind maps, infographics and documents. Built for teams who think visually.';
// Lower case: it follows "livediagram: " or starts a sentence through sentencePitch.
export const SITE_PITCH =
  'a real-time canvas for diagrams, whiteboards, illustrations and documents';
export const sentencePitch = () => `${SITE_PITCH[0]!.toUpperCase()}${SITE_PITCH.slice(1)}.`;

// The open-source repository (docs/specs/002-project-scope/open-source-and-business-model.md: the codebase is public + MIT), linked
// from the footer, the FAQ, the status page, the help centre's contact page,
// the editor's bottom bar and Explorer menu, and the `sameAs` JSON-LD.
export const REPO_URL = 'https://github.com/livediagram-app/livediagram.app';

// Favicon set for the apps that serve their pages from the origin root (or
// reference the root's assets): the SVG mark, a raster PNG fallback for
// browsers that ignore SVG favicons (older Safari would otherwise show a
// blank tab), and the opaque iOS tile. These are literal origin-root hrefs,
// so Next leaves them un-prefixed by an app's basePath / assetPrefix and the
// router resolves them to the workers that already serve them (every app
// serves /icon.svg; marketing serves the PNG + /apple-icon). Declaring
// `icons` overrides Next's file-based auto-discovery, which is why the apple
// tile is listed too. The help centre deliberately doesn't use this: it
// serves its own basePath-aware app/icon.svg so standalone dev has a favicon.
export const BRAND_ICONS: NonNullable<Metadata['icons']> = {
  icon: [
    { url: '/icon.svg', type: 'image/svg+xml' },
    { url: '/livediagram-icon-256.png', type: 'image/png', sizes: '256x256' },
  ],
  apple: '/apple-icon',
};

// Mobile chrome + colour-scheme signal for the public sites: brand-500 tints
// Android Chrome's URL bar, the iOS PWA status bar and the Windows tile, and
// 'light dark' says the pages paint both appearances. The painted one is the
// CSS `color-scheme` the shared theme sets from the `dark` class, which outranks
// this hint (docs/specs/004-interface-design/appearance.md). The editor has its own
// viewport (pinned zoom, docs/specs/007-editor/live-app.md) and doesn't use this.
export const PUBLIC_VIEWPORT: Viewport = {
  themeColor: '#0EA5E9',
  colorScheme: 'light dark',
};

// Every app paints its own dark appearance, so the Dark Reader extension stands
// down on sight of this meta instead of recolouring it. It keys on the name
// alone; the content is non-empty because Next drops an empty one.
export const DARK_READER_LOCK = { 'darkreader-lock': 'true' } as const;
