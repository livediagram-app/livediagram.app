// Test support for metric-emitters.test.ts: the values each COMPUTED emitter
// can send. The emitter scan (emitter-scan.ts) knows a computed emit site
// exists but not what its type will be, and "some chart counts this
// category·action" is not enough: `UI·Changed·Presentation-<field>` sat on
// no chart at all, and the photo import's `AI·Used·Photo*` inflated a card
// about the AI panel, both unseen because a chart existed on the pair.
//
// So every computed site is declared here by `<path> <Category>·<Action>`,
// with the values it can send. Where the set is closed and written down
// somewhere, the values are read from that source, so they cannot drift;
// where it is open (an article slug, a page path, a status code), `open`
// says why and the values are representative samples. The test fails on a
// computed site with no entry, an entry with no site, or a value no chart
// counts.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALL_CTA_SOURCES,
  ALL_TIMING_TYPES,
  COMMUNITY_CATEGORIES,
  LEVEL_TELEMETRY_TYPE,
  COMMUNITY_REPORT_REASONS,
  PLACEMENT_DEFAULT_KEYS,
  SHEET_CHANGE_KINDS,
  pascalToken,
  placementDefaultTelemetryType,
} from '@livediagram/api-schema';
import { countedVerbs, SYNC_WATCH_TYPE } from '@livediagram/agent-verbs';
import { MCP_TOOL_VERBS } from '@livediagram/agent-verbs/mcp';
import { CANVAS_CONTROLS } from './event-vocab';

export type ComputedValues = {
  values: readonly (string | null)[];
  // Why the list is samples rather than the whole set. Unset: it is the set.
  open?: string;
};

const APPS = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(APPS, path), 'utf8');

// Every quoted token in the first block that follows `marker`.
function tokensAfter(source: string, marker: string, close: string): string[] {
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const block = source.slice(start, source.indexOf(close, start + marker.length));
  return [...block.matchAll(/'([A-Za-z0-9-]+)'/g)].map((m) => m[1]!);
}

// The Drive mirror's inbound change types and Open with outcomes.
const DRIVE_INBOUND_TYPES = tokensAfter(
  read('live/lib/drive/plan-inbound.ts'),
  'export type InboundType',
  ';',
);
const DRIVE_OPEN_WITH_TYPES = tokensAfter(
  read('live/lib/drive/open-with.ts'),
  'export function openWithTelemetryType',
  '{',
);

// The api's email templates: `export type EmailKind = 'Welcome' | ...;`.
const EMAIL_KINDS = tokensAfter(read('api/src/email/templates.ts'), 'export type EmailKind', ';');

// The verbs the CLI counts (packages/agent-verbs), as their `Cli·Used` types, and `sync --watch`'s own.
const CLI_VERBS = [...countedVerbs().map((v) => pascalToken(v.id)), SYNC_WATCH_TYPE];

// Each tool the MCP server registers, from its verb (packages/agent-verbs mcp-tools.ts), as pascalToken(name).
const MCP_TOOLS = MCP_TOOL_VERBS.map((v) => pascalToken(v.mcp.tool));

// The Appearance settings' labels (packages/ui appearance-cycle.ts), the
// editor's `UI·Toggled` type on an explicit pick.
const APPEARANCE_LABELS = tokensAfter(
  read('../packages/ui/src/appearance/appearance-cycle.ts'),
  'export const APPEARANCE_LABEL',
  '};',
);

// The Explorer sidebar row kinds: `Sidebar.<Row>` on the page and `ExplorerPanel.<Row>` in the
// editor's panel, per SidebarTelemetryRow member.
const SIDEBAR_ROW_KINDS = tokensAfter(
  read('live/app/explorer/sidebar/sidebar-telemetry.ts'),
  'export type SidebarTelemetryRow',
  ';',
);
const SIDEBAR_ROWS = ['Sidebar', 'ExplorerPanel'].flatMap((prefix) =>
  SIDEBAR_ROW_KINDS.map((row) => `${prefix}.${row}`),
);

// The Explorer filters' facets (docs/specs/013-workspace/explorer-filters.md "Telemetry"): the
// values of LENS_TELEMETRY_TYPES, whose keys are lower case.
const LENS_FACETS = tokensAfter(
  read('../packages/explorer-lens/src/dimensions.ts'),
  'export const LENS_TELEMETRY_TYPES',
  '}',
).filter((token) => /^[A-Z]/.test(token));

// The Trash a Trash action happened in: TrashGroup's `telemetryType`.
const TRASH_TYPES = tokensAfter(read('live/lib/trash-groups.ts'), 'telemetryType:', ';');

// One closed value per default folder key (placementDefaultTelemetryType).
const DEFAULT_FOLDER_TYPES = PLACEMENT_DEFAULT_KEYS.map(placementDefaultTelemetryType);

// The presenter settings: `Presentation-<field>` per PresentationConfig key.
const PRESENTATION_FIELDS = (() => {
  const source = read('live/lib/presentation-config.ts');
  const start = source.indexOf('export type PresentationConfig = {');
  const block = source.slice(start, source.indexOf('\n};', start));
  return [...block.matchAll(/^ {2}([a-zA-Z]+)\??:/gm)].map((m) => `Presentation-${m[1]}`);
})();

// The photo import's detector tokens (apps/live photo-model/telemetry.ts):
// PhotoDetectHybrid<Backend> or PhotoDetectClassical<Reason>.
const PHOTO_DETECTORS = (() => {
  const source = read('live/lib/photo-model/telemetry.ts');
  // The records map an id to its token; keep the tokens (capitalised).
  const tokens = (marker: string) =>
    tokensAfter(source, marker, '};').filter((t) => /^[A-Z]/.test(t));
  return [
    ...tokens('const BACKEND').map((b) => `PhotoDetectHybrid${b}`),
    ...tokens('const FAILURE').map((r) => `PhotoDetectClassical${r}`),
  ];
})();

// The image picker's search failures (apps/live image-search/telemetry.ts):
// every `ImageSearch.<Reason>` token in its fixed tables.
const IMAGE_SEARCH_WARNINGS = [
  ...new Set(
    [...read('live/lib/image-search/telemetry.ts').matchAll(/'(ImageSearch\.[A-Za-z.]+)'/g)].map(
      (m) => m[1]!,
    ),
  ),
];

// The welcome tour's steps, in order, as tourStepTelemetryType makes them
// (apps/live tour-steps.ts). The welcome card sends no step view.
export const TOUR_STEP_SOURCE: string[] = [
  ...read('live/components/tour/tour-steps.ts').matchAll(/^ {4}id: '([a-z-]+)',/gm),
]
  .map((m) => m[1]!)
  .filter((id) => id !== 'welcome')
  .map(
    (id) =>
      `TourStep${id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')}`,
  );

// The Plan tour's steps, as planTourStepTelemetryType makes them (apps/live plan-tour-steps.ts,
// docs/specs/026-plan/plan-tour.md), both tracks; the two outros share one id. The welcome card sends no step view.
export const PLAN_TOUR_STEP_SOURCE: string[] = [
  ...new Set(
    [...read('live/components/tour/plan-tour-steps.ts').matchAll(/^ {4}id: '([a-z-]+)',/gm)].map(
      (m) => m[1]!,
    ),
  ),
]
  .filter((id) => id !== 'welcome')
  .map(
    (id) =>
      `PlanTourStep${id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')}`,
  );

// The Facilitate tour's steps, as facilitateTourStepTelemetryType makes them (apps/live
// facilitate-tour-steps.ts, docs/specs/012-collaboration/facilitate-tour.md). The welcome card sends no step view.
export const FACILITATE_TOUR_STEP_SOURCE: string[] = [
  ...read('live/components/tour/facilitate-tour-steps.ts').matchAll(/^ {4}id: '([a-z-]+)',/gm),
]
  .map((m) => m[1]!)
  .filter((id) => id !== 'welcome')
  .map(
    (id) =>
      `FacilitateTourStep${id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')}`,
  );

// Plan items name their type (titleCaseType of an item type id); set-up changes name the part.
const PLAN_ITEM_TYPES = ['Task', 'Story', 'Bug', 'Epic', 'Note', 'Idea', 'Action', 'Risk'];
const PLAN_TYPE_WHY = "titleCaseType(type): an item type's id, or a later type an agent made";
const PLAN_SETUP_PARTS = [
  'Title',
  'BoardSetUp',
  'ColumnAdded',
  'ColumnAddedExisting',
  'ColumnRenamed',
  'ColumnReordered',
  'ColumnRemoved',
  'ColumnColour',
  'WipLimit',
  'ColumnWidth',
  'DoneColumn',
  'Swimlanes',
  'Scope',
  'CardFields',
  'CardSize',
  'PlanCardSize',
  'AddTypes',
  'Widgets',
  'Voting',
  'VoteBudget',
  'HideWriting',
];
const SLUGS = ['your-first-diagram', 'tips-format-painter', 'connect-ai-mcp'];
const SLUG_WHY = "a help article's telemetry id, one per registered article";
const THEMES = ['Default', 'Plum', 'Custom'];
const THEME_WHY = "themeTelemetryLabel(themeId): a built-in theme's label, or Custom";
const TEMPLATES = ['Flowchart', 'Mindmap', 'Event-storming'];
const TEMPLATE_WHY = "titleCaseType(kind): a template's kind";
const ELEMENT_KINDS = ['Square', 'Circle', 'Sticky', 'Icon', 'TechIcon', 'Banner', 'Video'];
const ELEMENT_WHY = 'an element kind, as the palette catalogue spells it';
const API_ERRORS = [
  'Http403.LoadTab.Forbidden',
  'Http500.SaveTab',
  'Network.Put.Documents.Tabs',
  'Auth.NoSessionToken',
  'SaveFailed.TypeError',
];
const API_ERROR_WHY = 'a status or kind plus the request that failed, and the worker error token';

// The Community (docs/specs/025-community/community.md "Telemetry"): a post's category and a
// report's reason as their closed `type` tokens, and the gallery filter kinds the Community app's
// CommunitySelection union names.
const COMMUNITY_CATEGORY_TYPES = COMMUNITY_CATEGORIES.map((c) => c.type);
const COMMUNITY_REASON_TYPES = COMMUNITY_REPORT_REASONS.map((r) => r.type);
const COMMUNITY_SELECTIONS = tokensAfter(
  read('community/lib/telemetry.ts'),
  'export type CommunitySelection',
  ';',
);

// Where a changeset came from, read off the front door's own type so the list cannot drift.
const AGENT_FRONT_DOORS = tokensAfter(
  read('api/src/changesets/front-door.ts'),
  'export type FrontDoor =',
  ';',
);

export const COMPUTED_EMITTERS: Record<string, ComputedValues> = {
  // A share link's access level (docs/specs/013-workspace/share-roles.md), from LEVEL_TELEMETRY_TYPE.
  'apps/api/src/routes/share.ts Document·Joined': { values: Object.values(LEVEL_TELEMETRY_TYPE) },
  // The api worker.
  'apps/api/src/email/client.ts Email·Sent': { values: EMAIL_KINDS },
  'apps/api/src/email/client.ts Error·Api': {
    values: ['Http500.SendEmail', 'Http429.SendEmail'],
    open: 'Http<status>.SendEmail, any status Resend answers',
  },
  // Agent changesets (docs/specs/024-agents/agent-changesets.md), typed by the front door
  // (apps/api/src/changesets/front-door.ts).
  ...Object.fromEntries(
    ['Applied', 'Conflicted', 'Held', 'Reverted'].map((action) => [
      `apps/api/src/changesets/after.ts Agent·${action}`,
      { values: AGENT_FRONT_DOORS },
    ]),
  ),
  // Agent presence (docs/specs/024-agents/agent-presence.md), typed by the same front door.
  'apps/api/src/routes/agent-presence-routes.ts Agent·Present': { values: AGENT_FRONT_DOORS },
  'apps/api/src/index.ts Error·Api': {
    values: ['Internal.Put.Documents.Tabs', 'Internal.Get.Documents'],
    open: 'Internal.<Method>.<Route>, the route the worker was serving',
  },

  // The CLI (apps/cli).
  'apps/cli/src/telemetry.ts Cli·Used': { values: CLI_VERBS },
  'apps/cli/src/telemetry.ts Error·Api': {
    values: ['Http503.TabView', 'Internal.DocumentLs'],
    open: 'a status or Internal, plus the command that failed',
  },

  // The MCP worker.
  'apps/mcp/src/tool-annotations.ts Mcp·Used': { values: MCP_TOOLS },
  'apps/mcp/src/api.ts Error·Api': {
    values: ['Http503.CreateDocument', 'Internal.ReadDocument'],
    open: 'a status or Internal, plus the tool that failed',
  },

  // The help centre.
  'apps/help/components/ArticleLayout.tsx Help·View': { values: SLUGS, open: SLUG_WHY },
  'apps/help/components/useArticleVote.ts Help·Helpful': { values: SLUGS, open: SLUG_WHY },
  'apps/help/components/useArticleVote.ts Help·Unhelpful': { values: SLUGS, open: SLUG_WHY },

  // The Community app.
  'apps/community/lib/telemetry.ts Community·Reported': { values: COMMUNITY_REASON_TYPES },
  'apps/community/lib/telemetry.ts Community·Selected': { values: COMMUNITY_SELECTIONS },

  // Shared packages.
  'packages/telemetry-client/src/index.ts Error·Client': {
    values: ['Uncaught.Document.TypeError', 'UnhandledRejection.Explorer.Error'],
    open: 'a kind, the page it happened on, and the error name',
  },
  // The Community's help deep links (docs/specs/018-help/contextual-help-links.md): COMMUNITY_HELP's two ids.
  'packages/ui/src/community/CommunityHelpLink.tsx UI·Opened': {
    values: ['community', 'finding-community-documents'],
    open: SLUG_WHY,
  },
  'packages/ui/src/PageViewTracker.tsx Page·View': {
    values: ['/', '/document', '/explorer/timeline', '/help/canvas/links', '/telemetry'],
    open: 'the page path, ids and query strings stripped',
  },

  // The editor.
  'apps/live/app/document/[id]/useElementCreation.ts Element·Added': {
    values: ELEMENT_KINDS,
    open: ELEMENT_WHY,
  },
  'apps/live/app/document/[id]/useSlideDeck.ts UI·Changed': { values: PRESENTATION_FIELDS },
  // ARTICLE_BLOCK_INSERT_EVENT (apps/live/lib/article/article-telemetry.ts): a block put into an
  // article from the page toolbar's Insert or the slash menu.
  'apps/live/components/canvas/article/PageToolbar.tsx Element·Added': {
    values: ['ArticleDivider', 'ArticlePageBreak', 'ArticleQuote', 'ArticleCode'],
  },
  'apps/live/components/canvas/article/ArticleEditor.tsx Element·Added': {
    values: ['ArticleDivider', 'ArticlePageBreak', 'ArticleQuote', 'ArticleCode'],
  },
  'apps/live/app/document/[id]/useTemplateFlow.ts Template·Used': {
    values: TEMPLATES,
    open: TEMPLATE_WHY,
  },
  'apps/live/app/document/[id]/useTemplateFlow.ts Theme·Changed': {
    values: THEMES,
    open: THEME_WHY,
  },
  'apps/live/app/explorer/useTimelineFeed.ts Timeline·Selected': {
    values: [
      'comments',
      'new',
      'edits',
      'renames',
      'deletions',
      'sharing',
      'actions',
      'teams',
      'filing',
      'account',
      'other',
    ],
  },
  // Which Trash (docs/specs/013-workspace/trash.md): lib/trash-groups.ts's
  // telemetryType, the one closed set both sites send.
  'apps/live/hooks/persistence/useTrash.ts Trash·Restored': { values: TRASH_TYPES },
  'apps/live/hooks/persistence/useTrash.ts Trash·Deleted': { values: TRASH_TYPES },
  'apps/live/hooks/persistence/useTrash.ts Trash·Cleared': { values: TRASH_TYPES },
  'apps/live/app/document/[id]/useDocumentTrashed.ts Trash·Restored': { values: TRASH_TYPES },
  'apps/live/app/explorer/sidebar/sidebar-telemetry.ts UI·Selected': { values: SIDEBAR_ROWS },
  // Plan mode (docs/specs/026-plan/plan-mode.md "Telemetry"): an item type, or a set-up part.
  'apps/live/hooks/plan/usePlanSlice.ts Plan·Added': {
    values: PLAN_ITEM_TYPES,
    open: PLAN_TYPE_WHY,
  },
  'apps/live/hooks/plan/usePlanSlice.ts Plan·Deleted': {
    values: PLAN_ITEM_TYPES,
    open: PLAN_TYPE_WHY,
  },
  'apps/live/components/plan/track-board-setup.ts Plan·Changed': { values: PLAN_SETUP_PARTS },
  // A board or a view maximised from its header, or restored (maximised-plan.ts MaximisedKind).
  'apps/live/hooks/plan/maximised-plan.ts Plan·Toggled': {
    values: [
      'BoardMaximised',
      'ViewMaximised',
      'SheetMaximised',
      'BoardRestored',
      'ViewRestored',
      'SheetRestored',
    ],
  },
  // A Sheet change names its kind (api-schema SHEET_CHANGE_KINDS); a formula's first use of a function, its name.
  'apps/live/components/sheets/sheet-controller.tsx Sheet·Changed': {
    values: [...SHEET_CHANGE_KINDS],
  },
  // A Sheet set up from Setup Sheet names how it started (SheetSetup.tsx TELEMETRY).
  'apps/live/components/sheets/SheetSetup.tsx Sheet·Created': {
    values: ['Blank', 'Budget', 'Tracker', 'Timesheet', 'Contacts', 'Cards', 'Csv'],
  },
  'apps/live/components/sheets/useSheetActions.ts Sheet·Used': {
    values: ['SUM', 'AVERAGE', 'IF', 'VLOOKUP', 'CARDCOUNT'],
    open: "a function's name, from the Sheet's closed function list (packages/sheets FUNCTION_NAMES)",
  },
  // An item opened: `Item` from a board or a list, or how the item panel moved to it (item-trail.ts ItemOpenVia).
  'apps/live/hooks/plan/usePlanSlice.ts Plan·Opened': {
    values: ['Item', 'Parent', 'ChildCard', 'Breadcrumb'],
  },
  // Default folders (docs/specs/013-workspace/default-folders.md "Telemetry"): one value per key.
  'apps/live/lib/placement-defaults/placement-defaults-store.ts Folder·Changed': {
    values: DEFAULT_FOLDER_TYPES,
  },
  'apps/live/lib/placement-defaults/placement-defaults-store.ts Folder·Cleared': {
    values: DEFAULT_FOLDER_TYPES,
  },
  'apps/live/app/explorer/lens/lens-telemetry.ts Explorer·Selected': { values: LENS_FACETS },
  // The Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry"):
  // the inbound change types and the Open with outcomes, read from their unions.
  'apps/live/lib/drive/browser-engine.ts Drive·Applied': { values: DRIVE_INBOUND_TYPES },
  'apps/live/components/drive/DriveOpen.tsx Drive·Opened': { values: DRIVE_OPEN_WITH_TYPES },
  'apps/live/app/new/page.tsx Theme·Changed': { values: THEMES, open: THEME_WHY },
  'apps/live/app/new/page.tsx Template·Used': { values: TEMPLATES, open: TEMPLATE_WHY },
  // Publishing to the Community: the post's category, as communityCategoryType.
  'apps/live/components/dialogs/community/CommunityPublishDialog.tsx Community·Shared': {
    values: COMMUNITY_CATEGORY_TYPES,
  },
  'apps/live/components/dialogs/community/CommunityPublishDialog.tsx Community·Changed': {
    values: COMMUNITY_CATEGORY_TYPES,
  },
  // The landing funnel (docs/specs/019-marketing/landing-funnel.md): the CTA a /new visit came from.
  'apps/live/app/new/useCtaAttribution.ts Cta·Opened': { values: ALL_CTA_SOURCES },
  'apps/live/app/new/useCtaAttribution.ts Cta·Created': { values: ALL_CTA_SOURCES },
  'apps/live/components/dialogs/SettingsDialog.tsx UI·Opened': {
    values: ['SettingsAppearance', 'SettingsEditor', 'SettingsAccount', 'SettingsPrivacy'],
    open: 'Settings<Category>, one per Settings category',
  },
  'apps/live/components/dialogs/ShareCopyMenu.tsx UI·Copied': {
    values: ['EmbedCode', 'LiveImage'],
  },
  'apps/live/components/notes/useNoteRichTextSession.ts Note·Used': {
    values: ['Bold', 'Italic', 'List', 'Heading'],
    open: 'the rich-text command a note applied',
  },
  'apps/live/components/palette/PaletteCategoryBrowser.tsx UI·Searched': {
    values: ['IconSearch', 'TechSearch', 'StickerSearch'],
  },
  'apps/live/components/palette/PaletteCategoryBrowser.tsx UI·Opened': {
    values: ['IconGroup', 'TechGroup', 'StickerGroup'],
  },
  'apps/live/components/panels/SearchPanel.tsx UI·Opened': { values: SLUGS, open: SLUG_WHY },
  'apps/live/components/panels/SearchPanel.tsx Search·Selected': {
    values: ['Document', 'Shared', 'Folder', 'Team', 'Tab', 'Element', 'Palette', 'Command'],
  },
  'apps/live/components/panels/useTeamPaneActions.ts Team·Removed': {
    values: ['Invite', 'Member', 'Self'],
  },
  'apps/live/hooks/ui/useImageSearch.ts Error·Warning': {
    values: IMAGE_SEARCH_WARNINGS,
  },
  'apps/live/components/primitives/AreaErrorBoundary.tsx Error·Client': {
    values: ['Render.Canvas.TypeError', 'Render.Header.Error'],
    open: 'Render.<Area>.<ErrorName>',
  },
  'apps/live/components/primitives/HelpArticleLink.tsx UI·Opened': {
    values: SLUGS,
    open: SLUG_WHY,
  },
  // Load recovery (docs/specs/007-editor/load-recovery.md): the watchdog's warnings, and a throw in
  // the load named by its error.
  'apps/live/app/document/[id]/useIdentityBootstrap.ts Error·Warning': {
    values: [
      'DocumentLoad.TimedOut.Identity',
      'DocumentLoad.TimedOut.Participant',
      'DocumentLoad.TimedOut.Document',
      'DocumentLoad.TimedOut.Share',
      'DocumentLoad.TimedOut.FirstTab',
      'DocumentLoad.AutoReload',
      'DocumentLoad.Late',
    ],
  },
  'apps/live/app/document/[id]/useIdentityBootstrap.ts Error·Client': {
    values: ['DocumentLoad.TypeError', 'DocumentLoad.Error'],
    open: 'DocumentLoad.<ErrorName>',
  },
  'apps/live/components/providers/ErrorTelemetryBoot.tsx Error·Warning': {
    values: ['OfflineStore.Unavailable', 'SessionToken.TimedOut'],
  },
  'apps/live/components/providers/ErrorTelemetryBoot.tsx Error·Api': {
    values: API_ERRORS,
    open: API_ERROR_WHY,
  },
  'apps/live/components/tour/PlanTourHost.tsx UI·View': { values: PLAN_TOUR_STEP_SOURCE },
  'apps/live/components/tour/FacilitateTourHost.tsx UI·View': {
    values: FACILITATE_TOUR_STEP_SOURCE,
  },
  'apps/live/components/tour/TourHost.tsx UI·View': { values: TOUR_STEP_SOURCE },
  'apps/live/hooks/canvas/commit-freehand.ts Element·Added': {
    values: ['Square', 'Circle', 'Diamond', 'Triangle'],
    open: 'the shape the Shape Pen recognised',
  },
  'apps/live/hooks/canvas/useDebouncedCanvasTelemetry.ts Canvas·Changed': {
    values: Object.keys(CANVAS_CONTROLS),
  },
  'apps/live/hooks/canvas/usePhotoDraft.ts AI·Used': { values: PHOTO_DETECTORS },
  'apps/live/hooks/canvas/useShapeDrawing.ts Element·Added': {
    values: ['Banner', 'Callout', 'Image', 'Video', 'LinkCard'],
    open: 'a drawn component or media kind',
  },
  'apps/live/hooks/canvas/useTabCanvas.ts Tab·Aligned': {
    values: ['Smart', 'FlowchartDown', 'FlowchartRight', 'Tree', 'Mindmap'],
  },
  'apps/live/hooks/canvas/useTabCanvas.ts Canvas·Changed': {
    values: ['Blank', 'Grid', 'Dots', 'Graph'],
    open: 'titleCaseType(pattern): a background pattern',
  },
  'apps/live/hooks/canvas/useTabTheme.ts Theme·Changed': { values: THEMES, open: THEME_WHY },
  'apps/live/hooks/editor/useLogoTools.ts UI·Toggled': {
    values: [
      'LogoGuidesOn',
      'LogoGuidesOff',
      'LogoMirrorOn',
      'LogoMirrorOff',
      ...['CentreLines', 'Diagonals', 'SafeArea', 'Circles', 'Square', 'Grid'].flatMap((p) => [
        `LogoGuide${p}On`,
        `LogoGuide${p}Off`,
      ]),
    ],
  },
  'apps/live/hooks/editor/useLogoTools.ts UI·Changed': {
    values: ['LogoGuideStrengthFaint', 'LogoGuideStrengthMedium', 'LogoGuideStrengthStrong'],
  },
  'apps/live/hooks/canvas/useStylePreview.ts Element·Changed': {
    values: ['TextTracking', 'TextWeight', 'TextCase', 'TextArc'],
  },
  'apps/live/hooks/canvas/useTextStyleSetters.ts Element·Toggled': {
    values: ['Bold', 'Italic', 'Underline', 'Strikethrough'],
  },
  'apps/live/hooks/canvas/useWhiteboard.ts Draw·Selected': {
    values: ['Main', 'Second', 'Third'],
    open: 'penTelemetryType: the place of the pen in the dock, never its colour',
  },
  'apps/live/hooks/canvas/useWebComponentSetters.ts Element·Changed': {
    values: ['Banner', 'Callout', 'StatRow'],
    open: 'elementTelemetryType of the web component a row was added to',
  },
  'apps/live/hooks/ui/useAppearance.ts UI·Toggled': { values: APPEARANCE_LABELS },
  // A new link's level (LEVEL_TELEMETRY_TYPE) and its expiry, the file's two computed sites.
  'apps/live/hooks/persistence/useShareLinks.ts Document·Shared': {
    values: [
      ...Object.values(LEVEL_TELEMETRY_TYPE),
      'ExpiryWeek',
      'ExpiryMonth',
      'ExpirySixMonths',
    ],
  },
  'apps/live/lib/element-telemetry.ts Element·Duplicated': { values: [null, 'ShiftDrag'] },
  'apps/live/lib/element-telemetry.ts Element·Added': { values: ELEMENT_KINDS, open: ELEMENT_WHY },
  // Timings (docs/specs/017-telemetry/timing-telemetry.md): every editor timing and every app's Web
  // Vitals go through the one reportTiming, so this one site sends every metric in every bucket.
  'packages/telemetry-client/src/timing.ts Timing·Measured': { values: ALL_TIMING_TYPES },
};
