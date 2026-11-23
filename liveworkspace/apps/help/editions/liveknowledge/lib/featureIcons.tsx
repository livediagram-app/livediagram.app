import {
  lucideAppWindow,
  lucideBookOpen,
  lucideBookOpenText,
  lucideCircleCheck,
  lucideClock,
  lucideEye,
  lucideFileDown,
  lucideFolder,
  lucideFolderRoot,
  lucideGlobe,
  lucideGitMerge,
  lucideGitPullRequest,
  lucideHeartPulse,
  lucideLibrary,
  lucideLink,
  lucideListTree,
  lucideMessageCircle,
  lucidePaintbrush,
  lucidePanelsTopLeft,
  lucidePencilLine,
  lucidePictureInPicture2,
  lucideSearch,
  lucideShieldCheck,
  lucideSparkles,
  lucideTable,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import { Prims, Glyph as UiGlyph } from '@liveknowledge/ui';
import type { ReactNode } from 'react';

/** Feature slug → icon (full <svg>), for the home grid, the features index and the MDX <Feature> cards. Outline
 *  glyphs at w-6 h-6, `currentColor` so the call site sets the hue (featureColours.ts). A Knowledgebase has no canvas,
 *  so a slug missing here falls back to the page tree's glyph (edition.ts), never a canvas frame. The shared
 *  features keep the glyphs livedocuments' help draws them with. */
export function Glyph({ children }: { children: ReactNode }) {
  return (
    <UiGlyph size={24} units={24} className="h-6 w-6">
      {children}
    </UiGlyph>
  );
}

/** One lucide glyph, drawn the way every card glyph is. */
const lucide = (prims: Parameters<typeof Prims>[0]['prims']) => (
  <Glyph>
    <Prims prims={prims} />
  </Glyph>
);

export const FEATURE_ICONS: Record<string, ReactNode> = {
  // ---- Knowledgebase: Pages ----
  'the-page-tree': lucide(lucideListTree),
  'writing-on-a-page': lucide(lucidePencilLine),
  'linking-pages': lucide(lucideLink),
  'embedding-from-other-apps': lucide(lucidePictureInPicture2),
  'watching-a-page': lucide(lucideEye),
  // ---- Trust ----
  'owners-and-verifying': lucide(lucideCircleCheck),
  'review-due-and-the-review-period': lucide(lucideClock),
  'page-health': lucide(lucideHeartPulse),
  'knowledge-health-and-reminders': lucide(lucideShieldCheck),
  'required-reading': lucide(lucideBookOpen),
  // ---- Finding Things ----
  'searching-a-knowledgebase': lucide(lucideSearch),
  ask: lucide(lucideMessageCircle),
  'ai-settings': lucide(lucideSparkles),
  // ---- Insights ----
  // A plug: an agent connected to the Knowledgebase.
  'connecting-an-agent': (
    <Glyph>
      <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />
    </Glyph>
  ),
  // A robot's head: what an agent may do.
  'what-agents-can-do': (
    <Glyph>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4M9 13h.01M15 13h.01M9.5 17h5" />
    </Glyph>
  ),
  'suggested-edits': lucide(lucideGitPullRequest),
  // A speech bubble with a question mark: a question nobody could answer.
  'questions-nobody-could-answer': (
    <Glyph>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M10 9a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2M12 14h.01" />
    </Glyph>
  ),
  'pages-that-disagree': lucide(lucideGitMerge),
  // A page held inside a frame: always handed over first.
  'always-in-context': (
    <Glyph>
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </Glyph>
  ),
  // ---- Style ----
  'knowledgebase-style': lucide(lucidePaintbrush),
  // ---- Import and Export ----
  'import-a-markdown-folder': lucide(lucideFolder),
  'import-from-notion': lucide(lucideBookOpenText),
  'import-from-confluence': lucide(lucideLibrary),
  'exporting-a-knowledgebase': lucide(lucideFileDown),
  'publishing-to-the-web': lucide(lucideGlobe),
  // ---- Roles ----
  'knowledgebase-roles': lucide(lucideTable),
  sharing: (
    <Glyph>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </Glyph>
  ),
  'share-link-expiry': (
    <Glyph>
      <path d="M8.5 12H4.5a3 3 0 010-6h5" />
      <path d="M6 9h6" />
      <circle cx="15.5" cy="14.5" r="6" />
      <path d="M15.5 11.5v3l2.2 1.4" />
    </Glyph>
  ),
  'share-passwords': (
    <Glyph>
      <rect x="2.5" y="8" width="19" height="8" rx="2.5" />
      <circle cx="7.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <path d="M19 12h.01" />
      <path d="M12 5.5V4a2.5 2.5 0 015 0v1.5" />
    </Glyph>
  ),
  'request-approval': (
    <Glyph>
      <path d="M13.5 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8.5z" />
      <path d="M13.5 3v5.5H19" />
      <path d="M8.8 14.2l2.3 2.3 4.2-4.6" />
    </Glyph>
  ),
  'one-tab': (
    <Glyph>
      <Prims prims={lucidePanelsTopLeft} />
    </Glyph>
  ),
  embeds: (
    <Glyph>
      <rect x="2" y="3.5" width="20" height="17" rx="2" />
      <path d="M2 7.5h20" />
      <rect x="5.5" y="10.5" width="6" height="4" rx="1" />
      <circle cx="17" cy="15.5" r="2.2" />
      <path d="M11.5 12.5h3.5" />
    </Glyph>
  ),
  community: (
    <Glyph>
      <rect x="2.5" y="4" width="8" height="7" rx="1.5" />
      <rect x="13.5" y="4" width="8" height="7" rx="1.5" />
      <rect x="2.5" y="14" width="8" height="6" rx="1.5" />
      <path d="M17.5 20.5l-2.6-2.5a1.6 1.6 0 012.6-1.9 1.6 1.6 0 012.6 1.9z" />
    </Glyph>
  ),
  'finding-community-documents': (
    <Glyph>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M9 7.5 8 13.5M12.5 7.5l-1 6M7 9.5h6M6.5 11.5h6" />
    </Glyph>
  ),
  comments: (
    <Glyph>
      <path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z" />
    </Glyph>
  ),
  'live-presence': (
    <Glyph>
      <path d="M4 5l7 14 2.2-5.8L19 11 4 5z" />
      <circle cx="18" cy="6" r="2.5" />
    </Glyph>
  ),
  snapshots: (
    <Glyph>
      <path d="M4 8.5h3.2L8.8 6h6.4l1.6 2.5H20v10H4z" />
      <circle cx="12" cy="13.3" r="3.2" />
    </Glyph>
  ),
  teams: (
    <Glyph>
      <Prims prims={lucideUsers} />
    </Glyph>
  ),
  'roles-and-invites': (
    <Glyph>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 7l9.5 6 9.5-6" />
      <circle cx="12" cy="15" r="1.6" />
      <path d="M9.6 18.8a2.6 2.6 0 014.8 0" />
    </Glyph>
  ),
  'team-shared-documents': (
    <Glyph>
      <path d="M2.5 8A1.5 1.5 0 014 6.5h4L9.5 8.5h5A1.5 1.5 0 0116 10v7.5A1.5 1.5 0 0114.5 19H4A1.5 1.5 0 012.5 17.5z" />
      <path d="M17.5 8.5H22" />
      <path d="M19.5 6l2.5 2.5-2.5 2.5" />
    </Glyph>
  ),
  'audit-log': (
    <Glyph>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" />
      <path d="M9 10h6M9 13h6M9 16h3.5" />
    </Glyph>
  ),
  // A lightning bolt inside a turning loop: a rule that runs on its own, again and again.
  automations: (
    <Glyph>
      <path d="M4.5 12a7.5 7.5 0 0112.9-5.2" />
      <path d="M17.8 3.6v3.4h-3.4" />
      <path d="M19.5 12a7.5 7.5 0 01-12.9 5.2" />
      <path d="M6.2 20.4V17h3.4" />
      <path d="M12.8 7.8l-3.3 4.9h3l-.8 3.5 3.3-4.9h-3z" />
    </Glyph>
  ),
  'explorer-page': (
    <Glyph>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </Glyph>
  ),
  home: (
    <Glyph>
      <path d="M4 11.5 12 4.5l8 7" />
      <path d="M6 10v9.5h4.5v-5h3v5H18V10" />
    </Glyph>
  ),
  'personal-space': (
    <Glyph>
      <Prims prims={lucideFolder} />
    </Glyph>
  ),
  recent: (
    <Glyph>
      <Prims prims={lucideClock} />
    </Glyph>
  ),
  'shared-with-you': (
    <Glyph>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="17" cy="6.5" r="2.5" />
      <circle cx="17" cy="17.5" r="2.5" />
      <path d="M8.2 10.8l6.6-3.4M8.2 13.2l6.6 3.4" />
    </Glyph>
  ),
  'team-spaces': (
    <Glyph>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.5a3 3 0 0 1 0 5.8M17 19a5.5 5.5 0 0 0-3-4.9" />
    </Glyph>
  ),
  folders: (
    <Glyph>
      <path d="M2.5 6.5A1.5 1.5 0 014 5h3.5L9 6.5h4A1.5 1.5 0 0114.5 8v2" />
      <path d="M2.5 6.5v10A1.5 1.5 0 004 18h4" />
      <path d="M9 12.5A1.5 1.5 0 0110.5 11h2l1.5 1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 019 19z" />
    </Glyph>
  ),
  'default-folders': (
    <Glyph>
      <path d="M3 10.5A1.5 1.5 0 014.5 9h3L9 10.5h10.5A1.5 1.5 0 0121 12v6.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z" />
      <path d="M12 3v8.5" />
      <path d="M9 8.5l3 3 3-3" />
    </Glyph>
  ),
  filters: (
    <Glyph>
      <path d="M3 4.5h18l-7 8v6l-4 2v-8z" />
    </Glyph>
  ),
  'list-and-card-views': (
    <Glyph>
      <path d="M3 7h6M3 12h6M3 17h6" />
      <rect x="12.5" y="5" width="8.5" height="6" rx="1.5" />
      <rect x="12.5" y="13" width="8.5" height="6" rx="1.5" />
    </Glyph>
  ),
  activity: (
    <Glyph>
      <path d="M3 13.5V18a2 2 0 002 2h14a2 2 0 002-2v-4.5" />
      <path d="M3 13.5h4.5l1.5 2.5h6l1.5-2.5H21" />
      <path d="M8.5 7.5 11 10l4.5-5" />
    </Glyph>
  ),
  'image-gallery': (
    <Glyph>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5-7 7" />
    </Glyph>
  ),
  profile: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="2.8" />
      <path d="M6.5 19a6 6 0 0111 0" />
    </Glyph>
  ),
  settings: (
    <Glyph>
      <rect x="3" y="5" width="18" height="6" rx="3" />
      <circle cx="7.5" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="18" height="6" rx="3" />
      <circle cx="16.5" cy="17" r="1.6" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  'the-search-panel': (
    <Glyph>
      <circle cx="11" cy="11" r="7" />
      <path d="M16 16l5 5" />
    </Glyph>
  ),
  'command-palette': (
    <Glyph>
      <rect x="2.5" y="7" width="19" height="10" rx="2.5" />
      <path d="M6 10.5l2 1.5-2 1.5" />
      <path d="M11 13.5h7" />
    </Glyph>
  ),
};

/** Top-level feature category → glyph, the floor for a feature without its own. */
export const FEATURE_CATEGORY_ICONS: Record<string, ReactNode> = {
  // A book: the Knowledgebase itself.
  knowledgebase: (
    <Glyph>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6M9 10.5h4" />
    </Glyph>
  ),
  collaboration: lucide(lucideUsers),
  explorer: lucide(lucideFolderRoot),
  'user-interface': lucide(lucideAppWindow),
  // A wrench.
  tools: (
    <Glyph>
      <path d="M14.5 5.5a3.5 3.5 0 00-4.8 4.6l-6 6a1.5 1.5 0 002.1 2.1l6-6a3.5 3.5 0 004.6-4.8l-2.3 2.3-2-2 2.4-2.2z" />
    </Glyph>
  ),
  // A side panel with a magnifier.
  'search-panel': lucide(lucidePanelsTopLeft),
};
