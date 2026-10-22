import type { Metadata, Viewport } from 'next';

// The site-wide constants every public frontend shares. Before this each app
// kept its own copy (marketing and help had a `lib/site.ts` apiece, telemetry
// inlined the origin and the ShareRail hardcoded its own), so the origin
// lived in several places.

// The canonical origin. liveplanner.app is one origin: the router stitches
// the apps together by path (docs/specs/016-platform/router-app.md), so every app's metadataBase, JSON-LD
// ids and share links resolve against this one value (docs/specs/019-marketing/marketing-site.md "SEO and
// metadata").
export const SITE_URL = 'https://liveplanner.app';

// The product / site name: the metadata siteName and the JSON-LD name.
export const SITE_NAME = 'liveplanner';

// What liveplanner is, in the words every public surface uses (docs/specs/019-marketing/marketing-site.md
// "SEO and metadata"), kept here so they can't drift: the landing page's title, its description
// (also the web app manifest's), and the one-line pitch the share card, the share images' alt text
// and the share rail build on. It names every kind of thing a project holds: boards, sheets, dashboards and forms.
export const SITE_TITLE = 'liveplanner: Plan the work together, live';
export const SITE_DESCRIPTION =
  'Free planning in real time, with no trackers: boards of cards, spreadsheets, dashboards and forms in one project, shared with one link.';
// Lower case: it follows "liveplanner: " or starts a sentence through sentencePitch.
export const SITE_PITCH = 'boards, sheets, dashboards and forms, planned together in real time';
export const sentencePitch = () => `${SITE_PITCH[0]!.toUpperCase()}${SITE_PITCH.slice(1)}.`;

// The public contact form (a liveplanner Form, docs/specs/030-forms/forms.md), the one way to reach the
// team; no email address is published. Linked from the help centre's contact page, the FAQ, the status
// page and the Terms and Privacy Policy.
export const CONTACT_FORM_URL = 'https://www.liveplanner.app/form/90Bgj5sY9eTpVrjhx9tTZj';

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
    { url: '/liveplanner-icon-256.png', type: 'image/png', sizes: '256x256' },
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
  themeColor: '#8B5CF6',
  colorScheme: 'light dark',
};

// Every app paints its own dark appearance, so the Dark Reader extension stands
// down on sight of this meta instead of recolouring it. It keys on the name
// alone; the content is non-empty because Next drops an empty one.
export const DARK_READER_LOCK = { 'darkreader-lock': 'true' } as const;
