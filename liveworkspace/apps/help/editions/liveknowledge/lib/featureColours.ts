/** Feature slug → accent colour (hex), for the home and features grids and the MDX <Feature> cards. liveknowledge's
 *  brand is lime; its own features take hues around it (lime, green, emerald, teal, amber, sky, violet) so the
 *  Knowledgebase guides read as one family, and the shared features keep the hues livedocuments' help gives them.
 *  Keyed exactly as FEATURE_ICONS (a test holds the two maps in step). */
export const FEATURE_ENTITY_HEX: Record<string, string> = {
  // ---- Knowledgebase: Pages ----
  'the-page-tree': '#65a30d',
  'writing-on-a-page': '#4d7c0f',
  'linking-pages': '#0d9488',
  'embedding-from-other-apps': '#6366f1',
  'watching-a-page': '#2563eb',
  // ---- Trust ----
  'owners-and-verifying': '#16a34a',
  'review-due-and-the-review-period': '#d97706',
  'page-health': '#059669',
  'knowledge-health-and-reminders': '#15803d',
  'required-reading': '#4f46e5',
  // ---- Finding Things ----
  'searching-a-knowledgebase': '#0891b2',
  ask: '#7c3aed',
  'ai-settings': '#8b5cf6',
  // ---- Insights ----
  'connecting-an-agent': '#0284c7',
  'what-agents-can-do': '#0ea5e9',
  'suggested-edits': '#14b8a6',
  'questions-nobody-could-answer': '#f59e0b',
  'pages-that-disagree': '#e11d48',
  'always-in-context': '#84cc16',
  // ---- Style ----
  'knowledgebase-style': '#db2777',
  // ---- Import and Export ----
  'import-a-markdown-folder': '#ca8a04',
  'import-from-notion': '#57534e',
  'import-from-confluence': '#2563eb',
  'exporting-a-knowledgebase': '#0f766e',
  'publishing-to-the-web': '#0891b2',
  // ---- Roles ----
  'knowledgebase-roles': '#a855f7',
  // ---- Shared with every app ----
  sharing: '#0284c7',
  'share-link-expiry': '#f59e0b',
  'share-passwords': '#475569',
  'request-approval': '#16a34a',
  'one-tab': '#14b8a6',
  embeds: '#6366f1',
  community: '#ec4899',
  'finding-community-documents': '#8b5cf6',
  comments: '#f59e0b',
  'live-presence': '#06b6d4',
  'send-to-plan': '#0d9488',
  snapshots: '#0d9488',
  teams: '#a855f7',
  'roles-and-invites': '#a855f7',
  'team-shared-documents': '#0ea5e9',
  'audit-log': '#10b981',
  automations: '#7c3aed',
  'explorer-page': '#64748b',
  home: '#8b5cf6',
  'personal-space': '#f59e0b',
  recent: '#0ea5e9',
  'shared-with-you': '#10b981',
  'team-spaces': '#a855f7',
  folders: '#f59e0b',
  'default-folders': '#f59e0b',
  filters: '#6366f1',
  'list-and-card-views': '#0ea5e9',
  activity: '#f43f5e',
  'image-gallery': '#ec4899',
  profile: '#0891b2',
  settings: '#475569',
  'the-search-panel': '#6366f1',
  'command-palette': '#6366f1',
};

/** Top-level feature category → hue, for a feature without its own. Each distinct. */
export const FEATURE_CATEGORY_HEX: Record<string, string> = {
  knowledgebase: '#65a30d',
  collaboration: '#f59e0b',
  explorer: '#64748b',
  'user-interface': '#6366f1',
  tools: '#475569',
  'search-panel': '#0891b2',
};
