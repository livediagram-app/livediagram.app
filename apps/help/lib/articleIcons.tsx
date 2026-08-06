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
  // ---- Developers ----
  // Braces, not angle brackets: `code-blocks` in featureIcons is already `</>`.
  'api-overview': (
    <Glyph>
      <path d="M9 4.5C6.5 4.5 6.5 10 4 10c2.5 0 2.5 5.5 5 5.5" {...s} />
      <path d="M15 4.5c2.5 0 2.5 5.5 5 5.5-2.5 0-2.5 5.5-5 5.5" {...s} />
      <path d="M6.5 20h11" {...s} />
    </Glyph>
  ),
  // A key. Nothing else in either icon set is one, and it is the plainest
  // drawing of a bearer token that is not the token article's own ticket.
  authentication: (
    <Glyph>
      <circle cx="7.5" cy="9.5" r="4" {...s} />
      <path d="M10.3 12.3L20 22" {...s} />
      <path d="M15.5 17.5l2-2M18 20l2-2" {...s} />
    </Glyph>
  ),
  // Requests going out and data coming back.
  'working-with-diagrams': (
    <Glyph>
      <rect x="2.5" y="4" width="7" height="6" rx="1.5" {...s} />
      <rect x="14.5" y="14" width="7" height="6" rx="1.5" {...s} />
      <path d="M11 6.5h7.5M16.5 4.5l2 2-2 2" {...s} />
      <path d="M13 17.5H5.5M7.5 15.5l-2 2 2 2" {...s} />
    </Glyph>
  ),
  'errors-and-rate-limits': (
    <Glyph>
      <path d="M12 3.5L22 20.5H2z" {...s} />
      <path d="M12 10v4.5" {...s} />
      <path d="M12 17.5h.01" {...s} />
    </Glyph>
  ),
  // ---- Account and data ----
  // A ticket with the secret punched into it. The key belongs to
  // `authentication`, which is the article about using one.
  'api-tokens': (
    <Glyph>
      <path
        d="M3 7.5A1.5 1.5 0 014.5 6h15A1.5 1.5 0 0121 7.5v2a2.5 2.5 0 000 5v2a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5z"
        {...s}
      />
      <path d="M7 12h.01M10 12h.01M13 12h.01" {...s} />
    </Glyph>
  ),
  // A plug: the article is about connecting an outside tool.
  'connect-ai-mcp': (
    <Glyph>
      <path d="M9 3.5v5M15 3.5v5" {...s} />
      <path d="M6.5 8.5h11v3a5.5 5.5 0 01-11 0z" {...s} />
      <path d="M12 17v3.5" {...s} />
    </Glyph>
  ),
  // An envelope with the bell that decides whether it is sent.
  // `roles-and-invites` is an envelope with a person on it.
  'email-notifications': (
    <Glyph>
      <path
        d="M2.5 7A1.5 1.5 0 014 5.5h11A1.5 1.5 0 0116.5 7v8A1.5 1.5 0 0115 16.5H4A1.5 1.5 0 012.5 15z"
        {...s}
      />
      <path d="M2.5 7l7 4.5L16.5 7" {...s} />
      <path d="M17 12.5a2.5 2.5 0 015 0v2.5h-5z" {...s} />
      <path d="M18.7 17a1 1 0 001.6 0" {...s} />
    </Glyph>
  ),
  // ---- Supported devices ----
  // Three siblings, told apart by proportion: that IS the subject.
  desktop: (
    <Glyph>
      <rect x="2.5" y="4" width="19" height="12" rx="2" {...s} />
      <path d="M9 20h6M12 16v4" {...s} />
    </Glyph>
  ),
  tablet: (
    <Glyph>
      <rect x="5" y="2.5" width="14" height="19" rx="2" {...s} />
      <path d="M12 18.5h.01" {...s} />
    </Glyph>
  ),
  mobile: (
    <Glyph>
      <rect x="7.5" y="2.5" width="9" height="19" rx="2" {...s} />
      <path d="M10.5 5.5h3" {...s} />
      <path d="M12 18.5h.01" {...s} />
    </Glyph>
  ),
  // ---- Tips ----
  // Two of the same thing plus a plus: another one of these. `shadows` is an
  // offset FILLED copy and `panel-opacity` is two panels showing through.
  'duplicating-elements': (
    <Glyph>
      <rect x="3" y="3.5" width="11" height="9" rx="1.5" {...s} />
      <rect x="10" y="11.5" width="11" height="9" rx="1.5" {...s} />
      <path d="M15.5 14.5v3M14 16h3" {...s} />
    </Glyph>
  ),
  // A clipboard, which is literally what the article is about.
  'copy-and-paste': (
    <Glyph>
      <rect x="4.5" y="4.5" width="15" height="17" rx="2" {...s} />
      <path d="M9 4.5V3.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 3.5v1" {...s} />
      <path d="M8 11h8M8 15h5" {...s} />
    </Glyph>
  ),
  // ---- Privacy ----
  // A cloud with a line through it: the diagram never leaves the browser.
  'offline-mode': (
    <Glyph>
      <path d="M6.5 17.5a4 4 0 01.3-8 5.5 5.5 0 0110.4 1.4A3.5 3.5 0 0117 17.5z" {...s} />
      <path d="M4 20.5L20 4" {...s} />
    </Glyph>
  ),
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
