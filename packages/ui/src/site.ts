import type { Metadata, Viewport } from 'next';

// The site-wide constants every public frontend shares. Before this each app
// kept its own copy (marketing and help had a `lib/site.ts` apiece, telemetry
// inlined the origin, the ShareRail and the editor's GitHub link hardcoded
// theirs), so the origin and the repo URL lived in five places.

// The canonical origin. livediagram.app is one origin: the router stitches
// the apps together by path (spec/08), so every app's metadataBase, JSON-LD
// ids and share links resolve against this one value (spec/16 "SEO and
// metadata").
export const SITE_URL = 'https://livediagram.app';

// The product / site name: the metadata siteName and the JSON-LD name.
export const SITE_NAME = 'livediagram';

// The open-source repository (spec/03: the codebase is public + MIT), linked
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

// Mobile chrome + colour-scheme signal for the public (light-only) sites:
// brand-500 tints Android Chrome's URL bar, the iOS PWA status bar and the
// Windows tile, and colorScheme 'light' avoids a flash of dark-mode default
// styling on browsers that would otherwise auto-toggle (spec/16). The editor
// has its own viewport (pinned zoom, spec/07) and doesn't use this.
export const PUBLIC_VIEWPORT: Viewport = {
  themeColor: '#0EA5E9',
  colorScheme: 'light',
};
