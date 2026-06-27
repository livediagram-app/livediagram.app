import type { ReactNode } from 'react';
import { Glyph, iconStroke as s } from './featureIcons';

/**
 * Article slug → icon (full <svg>) for the **support** categories (About,
 * Getting Started, Tips, Account, Privacy, Self-Hosting, Troubleshooting),
 * whose cards render through {@link ../components/ArticleCard}. Feature
 * landings get their icons from {@link ./featureIcons} (FEATURE_ICONS); this
 * map covers the standalone support articles so every card carries a glyph.
 *
 * Same conventions as FEATURE_ICONS: outline glyphs at h-6 w-6, `currentColor`
 * so the call site sets the hue. Missing slugs fall back to a document glyph
 * at the call site, so a support card is never icon-less.
 */
export const SUPPORT_ARTICLE_ICONS: Record<string, ReactNode> = {
  // ---- About ----
  'what-is-livediagram': (
    <Glyph>
      <circle cx="12" cy="12" r="9" {...s} />
      <path d="M12 11v5" {...s} />
      <path d="M12 8h.01" {...s} />
    </Glyph>
  ),
  'who-is-it-for': (
    <Glyph>
      <circle cx="9" cy="8" r="3.2" {...s} />
      <path d="M3 20a6 6 0 0 1 12 0" {...s} />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6.4M21 20a6 6 0 0 0-4-5.65" {...s} />
    </Glyph>
  ),
  'why-livediagram': (
    <Glyph>
      <path d="M9 18h6M10 21h4" {...s} />
      <path
        d="M12 3a6 6 0 0 0-4 10.5c.6.55 1 1.4 1 2.5h6c0-1.1.4-1.95 1-2.5A6 6 0 0 0 12 3Z"
        {...s}
      />
    </Glyph>
  ),
  'what-is-open-source': (
    <Glyph>
      <circle cx="6" cy="6" r="2.2" {...s} />
      <circle cx="6" cy="18" r="2.2" {...s} />
      <circle cx="18" cy="8" r="2.2" {...s} />
      <path d="M6 8.2v7.6" {...s} />
      <path d="M6 13c0-3 12-1.5 12-4.8" {...s} />
    </Glyph>
  ),

  // ---- Tips and Tricks ----
  'keyboard-shortcuts': (
    <Glyph>
      <rect x="2.5" y="6" width="19" height="12" rx="2" {...s} />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8" {...s} />
    </Glyph>
  ),
  'command-palette': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M3 8.5h18" {...s} />
      <path d="M7 13h.01M11 13h.01M15 13h.01" {...s} />
    </Glyph>
  ),
  'fast-theming': (
    <Glyph>
      <path d="M12 3.5l1.6 4.4L18 9.5l-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z" {...s} />
      <path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" {...s} />
    </Glyph>
  ),
  'presenting-well': (
    <Glyph>
      <rect x="3" y="4" width="18" height="12" rx="1.5" {...s} />
      <path d="M12 16v4M8.5 20h7" {...s} />
      <path d="M10 8.5l4 2.5-4 2.5z" {...s} />
    </Glyph>
  ),

  // ---- Account and Data ----
  'guest-identity': (
    <Glyph>
      <circle cx="12" cy="8" r="3.6" {...s} />
      <path d="M5 20a7 7 0 0 1 14 0" {...s} />
    </Glyph>
  ),
  'signing-in': (
    <Glyph>
      <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" {...s} />
      <path d="M10 16l4-4-4-4M14 12H3" {...s} />
    </Glyph>
  ),
  'exporting-diagrams': (
    <Glyph>
      <path d="M12 15V3M8 7l4-4 4 4" {...s} />
      <path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" {...s} />
    </Glyph>
  ),
  'deleting-your-data': (
    <Glyph>
      <path d="M4 7h16" {...s} />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" {...s} />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" {...s} />
      <path d="M10 11v6M14 11v6" {...s} />
    </Glyph>
  ),

  // ---- Policies ----
  terms: (
    <Glyph>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" {...s} />
      <path d="M14 3v4h4" {...s} />
      <path d="M9 13h6M9 16.5h4" {...s} />
    </Glyph>
  ),
  'privacy-policy': (
    <Glyph>
      <path d="M12 3l8 3v5.5c0 4.7-3.4 7.8-8 9-4.6-1.2-8-4.3-8-9V6z" {...s} />
      <rect x="9" y="11" width="6" height="5" rx="1" {...s} />
      <path d="M10 11V9.5a2 2 0 0 1 4 0V11" {...s} />
    </Glyph>
  ),

  // ---- Privacy and Security ----
  'data-privacy': (
    <Glyph>
      <rect x="4" y="11" width="16" height="9" rx="2" {...s} />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" {...s} />
    </Glyph>
  ),
  'what-we-collect': (
    <Glyph>
      <path d="M3 20h18" {...s} />
      <path d="M6 20v-5M11 20V8M16 20v-8" {...s} />
    </Glyph>
  ),
  'share-link-security': (
    <Glyph>
      <path d="M10 13a4.5 4.5 0 0 0 6.4 0l2-2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1" {...s} />
      <path d="M14 11a4.5 4.5 0 0 0-6.4 0l-2 2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1" {...s} />
    </Glyph>
  ),
  'open-source-trust': (
    <Glyph>
      <path d="M12 3l8 3v5.5c0 4.7-3.4 7.8-8 9-4.6-1.2-8-4.3-8-9V6z" {...s} />
      <path d="M9 12l2 2 4-4" {...s} />
    </Glyph>
  ),

  // ---- Self-Hosting ----
  'self-hosting-overview': (
    <Glyph>
      <rect x="3" y="4" width="18" height="7" rx="1.5" {...s} />
      <rect x="3" y="13" width="18" height="7" rx="1.5" {...s} />
      <path d="M7 7.5h.01M7 16.5h.01" {...s} />
    </Glyph>
  ),
  'deploying-livediagram': (
    <Glyph>
      <path d="M5 17a4 4 0 0 1 .8-7.9 6 6 0 0 1 11.3-1.6A3.6 3.6 0 0 1 18.5 17" {...s} />
      <path d="M12 13v6M9.5 15.5L12 13l2.5 2.5" {...s} />
    </Glyph>
  ),
  configuration: (
    <Glyph>
      <path d="M4 7h9M17 7h3" {...s} />
      <path d="M4 12h3M11 12h9" {...s} />
      <path d="M4 17h7M15 17h5" {...s} />
      <circle cx="15" cy="7" r="2" {...s} />
      <circle cx="9" cy="12" r="2" {...s} />
      <circle cx="13" cy="17" r="2" {...s} />
    </Glyph>
  ),

  // ---- Troubleshooting ----
  'diagram-not-loading': (
    <Glyph>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" {...s} />
      <path d="M14 3v6h6" {...s} />
      <path d="M9.5 13l5 5M14.5 13l-5 5" {...s} />
    </Glyph>
  ),
  'cannot-sign-in': (
    <Glyph>
      <circle cx="8" cy="15" r="5" {...s} />
      <path d="M11.5 11.5L21 2M17 6l3 3M14 9l2.5 2.5" {...s} />
    </Glyph>
  ),
  'collaboration-issues': (
    <Glyph>
      <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" {...s} />
      <path d="M3 3l18 18" {...s} />
    </Glyph>
  ),
  'browser-compatibility': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M3 8.5h18M6.5 6.2h.01M9.5 6.2h.01" {...s} />
    </Glyph>
  ),
  'missing-changes': (
    <Glyph>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M5 3v4h4" {...s} />
      <path d="M12 8v4.5l3 1.8" {...s} />
    </Glyph>
  ),
};

/** Document glyph: the fallback for any support article without a bespoke icon
 *  in {@link SUPPORT_ARTICLE_ICONS}, so no support card ever renders icon-less. */
export const SUPPORT_ARTICLE_FALLBACK: ReactNode = (
  <Glyph>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...s} />
    <path d="M14 3v5h5M8.5 13h7M8.5 16.5h7" {...s} />
  </Glyph>
);
