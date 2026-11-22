import {
  lucideAppWindow,
  lucideBraces,
  lucideChartColumn,
  lucideCircleAlert,
  lucideFileUp,
  lucideKey,
  lucideMail,
  lucideMessageCircle,
  lucideRefreshCw,
  lucideSquareCode,
  lucideUsers,
  lucideWandSparkles,
} from '@liveworkspace/icons/lucide';
import type { ReactNode } from 'react';
import { Prims } from '@liveknowledge/ui';
import { Glyph } from './featureIcons';

/**
 * Article slug → icon (full <svg>) for the **support** categories (About, Getting Started, Account, Privacy,
 * Developers, Troubleshooting), whose cards render through ArticleCard (@liveworkspace/help-site). Feature landings
 * take theirs from {@link ./featureIcons}. The shared articles keep livedocuments' glyphs; liveknowledge's own are
 * below them. Outline glyphs at h-6 w-6, `currentColor`; a slug missing here falls back to a page glyph.
 */
export const SUPPORT_ARTICLE_ICONS: Record<string, ReactNode> = {
  // ---- liveknowledge's own ----
  // A book: the Knowledgebase.
  'what-is-liveknowledge': (
    <Glyph>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6M9 10.5h4" />
    </Glyph>
  ),
  // A page with a plus: the first page of a new Knowledgebase.
  'your-first-knowledgebase': (
    <Glyph>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M12 11v6M9 14h6" />
    </Glyph>
  ),
  'describe-to-set-up': (
    <Glyph>
      <Prims prims={lucideWandSparkles} />
    </Glyph>
  ),
  // A house: Home.
  'knowledgebase-home': (
    <Glyph>
      <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />
    </Glyph>
  ),
  // Two people and a link between them.
  'sharing-your-document': (
    <Glyph>
      <Prims prims={lucideUsers} />
    </Glyph>
  ),
  // A person beside a key: guest or account.
  'guest-vs-account': (
    <Glyph>
      <circle cx="8" cy="8" r="3" />
      <path d="M3 19a5 5 0 0 1 10 0M15 12h6M18 9v6" />
    </Glyph>
  ),
  'liveknowledge-mcp-tools': (
    <Glyph>
      <Prims prims={lucideSquareCode} />
    </Glyph>
  ),
  // A terminal prompt.
  'liveknowledge-cli': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M12 15h5" />
    </Glyph>
  ),
  'knowledge-api': (
    <Glyph>
      <Prims prims={lucideBraces} />
    </Glyph>
  ),
  'ask-is-not-answering': (
    <Glyph>
      <Prims prims={lucideMessageCircle} />
    </Glyph>
  ),
  'review-due-everywhere': (
    <Glyph>
      <Prims prims={lucideRefreshCw} />
    </Glyph>
  ),
  'an-import-left-pages-out': (
    <Glyph>
      <Prims prims={lucideFileUp} />
    </Glyph>
  ),
  'an-agent-cannot-write': (
    <Glyph>
      <Prims prims={lucideCircleAlert} />
    </Glyph>
  ),
  // ---- Shared with every app ----
  'who-is-it-for': (
    <Glyph>
      <Prims prims={lucideUsers} />
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
  'api-tokens': (
    <Glyph>
      <path d="M3 7.5A1.5 1.5 0 014.5 6h15A1.5 1.5 0 0121 7.5v2a2.5 2.5 0 000 5v2a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5z" />
      <path d="M7 12h.01M10 12h.01M13 12h.01" />
    </Glyph>
  ),
  'google-drive': (
    <Glyph>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M8 12h8M14 10l2 2-2 2M10 16l-2-2 2-2" />
    </Glyph>
  ),
  'email-notifications': (
    <Glyph>
      <Prims prims={lucideMail} />
    </Glyph>
  ),
  'data-privacy': (
    <Glyph>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Glyph>
  ),
  'offline-mode': (
    <Glyph>
      <path d="M6.5 17.5a4 4 0 01.3-8 5.5 5.5 0 0110.4 1.4A3.5 3.5 0 0117 17.5z" />
      <path d="M4 20.5L20 4" />
    </Glyph>
  ),
  'what-we-collect': (
    <Glyph>
      <Prims prims={lucideChartColumn} />
    </Glyph>
  ),
  'telemetry-dashboard': (
    <Glyph>
      <path d="M4 4v16h16" />
      <path d="M7.5 15l3.5-4 3 2.5 5-6" />
      <circle cx="19" cy="7.5" r="1.2" />
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
  'api-overview': (
    <Glyph>
      <Prims prims={lucideBraces} />
    </Glyph>
  ),
  authentication: (
    <Glyph>
      <circle cx="7.5" cy="9.5" r="4" />
      <path d="M10.3 12.3L20 22" />
      <path d="M15.5 17.5l2-2M18 20l2-2" />
    </Glyph>
  ),
  'errors-and-rate-limits': (
    <Glyph>
      <path d="M12 3.5L22 20.5H2z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5h.01" />
    </Glyph>
  ),
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
  'report-a-vulnerability': (
    <Glyph>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M15 15l5.5 5.5" />
      <rect x="8" y="8" width="4" height="5" rx="2" />
      <path d="M8 9.5H6.5M12 9.5h1.5M8 12H6.5M12 12h1.5M10 8V7" />
    </Glyph>
  ),
};

/** Page glyph: the fallback for any support article without a bespoke icon in {@link SUPPORT_ARTICLE_ICONS}. */
export const SUPPORT_ARTICLE_FALLBACK: ReactNode = (
  <Glyph>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M8.5 13h7M8.5 16.5h7" />
  </Glyph>
);
