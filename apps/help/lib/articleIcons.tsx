import {
  lucideAppWindow,
  lucideBraces,
  lucideChartColumn,
  lucideKey,
  lucideMail,
  lucideUsers,
} from '@livediagram/icons/lucide';
import type { ReactNode } from 'react';
import { Prims } from '@livediagram/ui';
import { Glyph } from './featureIcons';

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
      <Prims prims={lucideBraces} />
    </Glyph>
  ),
  // A key. Nothing else in either icon set is one, and it is the plainest
  // drawing of a bearer token that is not the token article's own ticket.
  authentication: (
    <Glyph>
      <circle cx="7.5" cy="9.5" r="4" />
      <path d="M10.3 12.3L20 22" />
      <path d="M15.5 17.5l2-2M18 20l2-2" />
    </Glyph>
  ),
  // Requests going out and data coming back.
  'working-with-documents': (
    <Glyph>
      <rect x="2.5" y="4" width="7" height="6" rx="1.5" />
      <rect x="14.5" y="14" width="7" height="6" rx="1.5" />
      <path d="M11 6.5h7.5M16.5 4.5l2 2-2 2" />
      <path d="M13 17.5H5.5M7.5 15.5l-2 2 2 2" />
    </Glyph>
  ),
  'errors-and-rate-limits': (
    <Glyph>
      <path d="M12 3.5L22 20.5H2z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5h.01" />
    </Glyph>
  ),
  // ---- Account and data ----
  // A ticket with the secret punched into it. The key belongs to
  // `authentication`, which is the article about using one.
  'api-tokens': (
    <Glyph>
      <path d="M3 7.5A1.5 1.5 0 014.5 6h15A1.5 1.5 0 0121 7.5v2a2.5 2.5 0 000 5v2a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5z" />
      <path d="M7 12h.01M10 12h.01M13 12h.01" />
    </Glyph>
  ),
  // A plug: the article is about connecting an outside tool.
  'connect-ai-mcp': (
    <Glyph>
      <path d="M9 3.5v5M15 3.5v5" />
      <path d="M6.5 8.5h11v3a5.5 5.5 0 01-11 0z" />
      <path d="M12 17v3.5" />
    </Glyph>
  ),
  // An envelope with the bell that decides whether it is sent.
  // `roles-and-invites` is an envelope with a person on it.
  'email-notifications': (
    <Glyph>
      <Prims prims={lucideMail} />
    </Glyph>
  ),
  // ---- Supported devices ----
  // Three siblings, told apart by proportion: that IS the subject.
  desktop: (
    <Glyph>
      <rect x="2.5" y="4" width="19" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </Glyph>
  ),
  tablet: (
    <Glyph>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <path d="M12 18.5h.01" />
    </Glyph>
  ),
  mobile: (
    <Glyph>
      <rect x="7.5" y="2.5" width="9" height="19" rx="2" />
      <path d="M10.5 5.5h3" />
      <path d="M12 18.5h.01" />
    </Glyph>
  ),
  // ---- Tips ----
  // Two of the same thing plus a plus: another one of these. `shadows` is an
  // offset FILLED copy and `panel-opacity` is two panels showing through.
  'duplicating-elements': (
    <Glyph>
      <rect x="3" y="3.5" width="11" height="9" rx="1.5" />
      <rect x="10" y="11.5" width="11" height="9" rx="1.5" />
      <path d="M15.5 14.5v3M14 16h3" />
    </Glyph>
  ),
  // A clipboard, which is literally what the article is about.
  'copy-and-paste': (
    <Glyph>
      <rect x="4.5" y="4.5" width="15" height="17" rx="2" />
      <path d="M9 4.5V3.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 3.5v1" />
      <path d="M8 11h8M8 15h5" />
    </Glyph>
  ),
  // ---- Privacy ----
  // A cloud with a line through it: the document never leaves the browser.
  'offline-mode': (
    <Glyph>
      <path d="M6.5 17.5a4 4 0 01.3-8 5.5 5.5 0 0110.4 1.4A3.5 3.5 0 0117 17.5z" />
      <path d="M4 20.5L20 4" />
    </Glyph>
  ),
  // ---- About ----
  'what-is-livediagram': (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Glyph>
  ),
  'who-is-it-for': (
    <Glyph>
      <Prims prims={lucideUsers} />
    </Glyph>
  ),
  'why-livediagram': (
    <Glyph>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.55 1 1.4 1 2.5h6c0-1.1.4-1.95 1-2.5A6 6 0 0 0 12 3Z" />
    </Glyph>
  ),
  'what-is-open-source': (
    <Glyph>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <path d="M6 8.2v7.6" />
      <path d="M6 13c0-3 12-1.5 12-4.8" />
    </Glyph>
  ),

  // ---- Tips and Tricks ----
  'keyboard-shortcuts': (
    <Glyph>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8" />
    </Glyph>
  ),
  'command-palette': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8.5h18" />
      <path d="M7 13h.01M11 13h.01M15 13h.01" />
    </Glyph>
  ),
  'fast-theming': (
    <Glyph>
      <path d="M12 3.5l1.6 4.4L18 9.5l-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z" />
      <path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </Glyph>
  ),
  'presenting-well': (
    <Glyph>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M12 16v4M8.5 20h7" />
      <path d="M10 8.5l4 2.5-4 2.5z" />
    </Glyph>
  ),

  // ---- Account and Data ----
  'guest-identity': (
    <Glyph>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Glyph>
  ),
  'signing-in': (
    <Glyph>
      <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M10 16l4-4-4-4M14 12H3" />
    </Glyph>
  ),
  'exporting-diagrams': (
    <Glyph>
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </Glyph>
  ),
  // A folder with a two-way arrow across it: the mirror kept in step.
  'google-drive': (
    <Glyph>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M8 12h8M14 10l2 2-2 2M10 16l-2-2 2-2" />
    </Glyph>
  ),
  // A bin with an arrow rising out of it: the way back. The plain bin is
  // `deleting-your-data`.
  trash: (
    <Glyph>
      <path d="M4 9h16" />
      <path d="M6 9l1 11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-11" />
      <path d="M12 18V5M8.5 8.5 12 5l3.5 3.5" />
    </Glyph>
  ),
  'deleting-your-data': (
    <Glyph>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </Glyph>
  ),

  // ---- Policies ----
  terms: (
    <Glyph>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 16.5h4" />
    </Glyph>
  ),
  'privacy-policy': (
    <Glyph>
      <path d="M12 3l8 3v5.5c0 4.7-3.4 7.8-8 9-4.6-1.2-8-4.3-8-9V6z" />
      <rect x="9" y="11" width="6" height="5" rx="1" />
      <path d="M10 11V9.5a2 2 0 0 1 4 0V11" />
    </Glyph>
  ),

  // ---- Privacy and Security ----
  'data-privacy': (
    <Glyph>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Glyph>
  ),
  'what-we-collect': (
    <Glyph>
      <Prims prims={lucideChartColumn} />
    </Glyph>
  ),
  'share-link-security': (
    <Glyph>
      <path d="M10 13a4.5 4.5 0 0 0 6.4 0l2-2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1" />
      <path d="M14 11a4.5 4.5 0 0 0-6.4 0l-2 2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1" />
    </Glyph>
  ),
  'open-source-trust': (
    <Glyph>
      <path d="M12 3l8 3v5.5c0 4.7-3.4 7.8-8 9-4.6-1.2-8-4.3-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </Glyph>
  ),

  // ---- Self-Hosting ----
  'self-hosting-overview': (
    <Glyph>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </Glyph>
  ),
  'deploying-livediagram': (
    <Glyph>
      <path d="M5 17a4 4 0 0 1 .8-7.9 6 6 0 0 1 11.3-1.6A3.6 3.6 0 0 1 18.5 17" />
      <path d="M12 13v6M9.5 15.5L12 13l2.5 2.5" />
    </Glyph>
  ),
  configuration: (
    <Glyph>
      <path d="M4 7h9M17 7h3" />
      <path d="M4 12h3M11 12h9" />
      <path d="M4 17h7M15 17h5" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="13" cy="17" r="2" />
    </Glyph>
  ),

  // ---- Troubleshooting ----
  'document-not-loading': (
    <Glyph>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M9.5 13l5 5M14.5 13l-5 5" />
    </Glyph>
  ),
  // A browser window with a circular arrow: the page put back to a fresh start.
  'repair-this-browser': (
    <Glyph>
      <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M3 8h18" />
      <path d="M15.5 14a3.5 3.5 0 1 1-1-2.45" />
      <path d="M15.5 10.5v2h-2" />
    </Glyph>
  ),
  'cannot-sign-in': (
    <Glyph>
      <Prims prims={lucideKey} />
    </Glyph>
  ),
  'collaboration-issues': (
    <Glyph>
      <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />
      <path d="M3 3l18 18" />
    </Glyph>
  ),
  'browser-compatibility': (
    <Glyph>
      <Prims prims={lucideAppWindow} />
    </Glyph>
  ),
  'missing-changes': (
    <Glyph>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M5 3v4h4" />
      <path d="M12 8v4.5l3 1.8" />
    </Glyph>
  ),
};

/** Document glyph: the fallback for any support article without a bespoke icon
 *  in {@link SUPPORT_ARTICLE_ICONS}, so no support card ever renders icon-less. */
export const SUPPORT_ARTICLE_FALLBACK: ReactNode = (
  <Glyph>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M8.5 13h7M8.5 16.5h7" />
  </Glyph>
);
