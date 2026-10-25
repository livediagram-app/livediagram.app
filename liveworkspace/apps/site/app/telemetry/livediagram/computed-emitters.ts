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
import { platformComputedEmitters } from '../platform-emitters';
import {
  ALL_CTA_SOURCES,
  ALL_TIMING_TYPES,
  COMMUNITY_CATEGORIES,
  LEVEL_TELEMETRY_TYPE,
  COMMUNITY_REPORT_REASONS,
  pascalToken,
  isValidTelemetryEvent,
} from '@livediagram/api-schema';
import { countedVerbs, SYNC_WATCH_TYPE } from '@livediagram/agent-verbs';
import { MCP_TOOL_VERBS } from '@livediagram/agent-verbs/mcp';
import { CANVAS_CONTROLS } from '../_shared/event-vocab';
import { EXPLORER_TELEMETRY_EVENTS } from '@liveworkspace/telemetry';

type ComputedValues = {
  values: readonly (string | null)[];
  // Why the list is samples rather than the whole set. Unset: it is the set.
  open?: string;
};

const APPS = resolve(__dirname, '../../../../../../livediagram/apps');
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
  read('editor/lib/drive/plan-inbound.ts'),
  'export type InboundType',
  ';',
);
const DRIVE_OPEN_WITH_TYPES = tokensAfter(
  read('editor/lib/drive/open-with.ts'),
  'export function openWithTelemetryType',
  '{',
);

// The api's email templates: `export type EmailKind = 'Welcome' | ...;`.
const EMAIL_KINDS = tokensAfter(read('api/src/email/templates.ts'), 'export type EmailKind', ';');

// The verbs the CLI counts (packages/agent-verbs), as their `Cli·Used` types, and `sync --watch`'s own.
const CLI_VERBS = [...countedVerbs().map((v) => pascalToken(v.id)), SYNC_WATCH_TYPE];

// Each tool the MCP server registers, from its verb (packages/agent-verbs mcp-tools.ts), as pascalToken(name).
const MCP_TOOLS = MCP_TOOL_VERBS.map((v) => pascalToken(v.mcp.tool));

// The Appearance settings' labels (@liveworkspace/ui appearance-cycle.ts), the
// editor's `UI·Toggled` type on an explicit pick.
const APPEARANCE_LABELS = tokensAfter(
  read('../../packages/ui/src/appearance/appearance-cycle.ts'),
  'export const APPEARANCE_LABEL',
  '};',
);

// The Explorer filter lens's facets (docs/specs/013-workspace/explorer-filters.md "Telemetry"): the values of the shared
// Explorer's LENS_TELEMETRY_TYPES, whose keys are lower case.
const LENS_FACETS = tokensAfter(
  read('../../packages/explorer/src/lens/dimensions.ts'),
  'export const LENS_TELEMETRY_TYPES',
  '}',
).filter((token) => /^[A-Z]/.test(token));

// The Trash a restored canvas sat in: useDocumentTrashed's `from`, Personal or Team.
const TRASH_TYPES = tokensAfter(
  read('editor/app/document/[id]/useDocumentTrashed.ts'),
  'const [from, setFrom] = useState<',
  '>',
);

// The presenter settings: `Presentation-<field>` per PresentationConfig key.
const PRESENTATION_FIELDS = (() => {
  const source = read('editor/lib/presentation-config.ts');
  const start = source.indexOf('export type PresentationConfig = {');
  const block = source.slice(start, source.indexOf('\n};', start));
  return [...block.matchAll(/^ {2}([a-zA-Z]+)\??:/gm)].map((m) => `Presentation-${m[1]}`);
})();

// The Settings dialog's presenter rows (settings-catalogue.ts presentingToggle / presentingChoice): a toggle sends
// `Presentation-<field>On|Off` for each boolean field, a choice `Presentation-<field><Option>` (choiceTelemetryType).
const PRESENTATION_SETTINGS = (() => {
  const source = read('editor/lib/presentation-config.ts');
  const start = source.indexOf('export type PresentationConfig = {');
  const block = source.slice(start, source.indexOf('\n};', start));
  const fields = [...block.matchAll(/^ {2}([a-zA-Z]+)\??: ([A-Za-z]+);/gm)].map(
    (m) => [m[1]!, m[2]!] as const,
  );
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const unionOf = (type: string) => {
    const m = new RegExp(`export type ${type} = ([^;]+);`).exec(source);
    return m ? [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!) : [];
  };
  const seconds = [...source.matchAll(/\{ seconds: (\d+),/g)].map((m) => m[1]!);
  return {
    toggled: fields
      .filter(([, type]) => type === 'boolean')
      .flatMap(([f]) => [`Presentation-${f}On`, `Presentation-${f}Off`]),
    changed: [
      ...fields
        .filter(([, type]) => type !== 'boolean' && type !== 'number')
        .flatMap(([f, type]) => unionOf(type).map((o) => `Presentation-${f}${cap(o)}`)),
      ...seconds.map((n) => `Presentation-autoAdvanceSeconds${n}`),
    ],
  };
})();

// The photo import's detector tokens (apps/editor photo-model/telemetry.ts):
// PhotoDetectHybrid<Backend> or PhotoDetectClassical<Reason>.
const PHOTO_DETECTORS = (() => {
  const source = read('editor/lib/photo-model/telemetry.ts');
  // The records map an id to its token; keep the tokens (capitalised).
  const tokens = (marker: string) =>
    tokensAfter(source, marker, '};').filter((t) => /^[A-Z]/.test(t));
  return [
    ...tokens('const BACKEND').map((b) => `PhotoDetectHybrid${b}`),
    ...tokens('const FAILURE').map((r) => `PhotoDetectClassical${r}`),
  ];
})();

// The image picker's search failures (apps/editor image-search/telemetry.ts):
// every `ImageSearch.<Reason>` token in its fixed tables.
const IMAGE_SEARCH_WARNINGS = [
  ...new Set(
    [...read('editor/lib/image-search/telemetry.ts').matchAll(/'(ImageSearch\.[A-Za-z.]+)'/g)].map(
      (m) => m[1]!,
    ),
  ),
];

// The welcome tour's steps, in order, as tourStepTelemetryType makes them
// (apps/editor tour-steps.ts). The welcome card sends no step view.
export const TOUR_STEP_SOURCE: string[] = [
  ...read('editor/components/tour/tour-steps.ts').matchAll(/^ {4}id: '([a-z-]+)',/gm),
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

// The Workshop tour's steps, as workshopTourStepTelemetryType makes them (apps/editor
// workshop-tour-steps.ts, docs/specs/012-collaboration/workshop-tour.md). The welcome card sends no step view.
const WORKSHOP_TOUR_STEP_SOURCE: string[] = [
  ...read('editor/components/tour/workshop-tour-steps.ts').matchAll(/^ {4}id: '([a-z-]+)',/gm),
]
  .map((m) => m[1]!)
  .filter((id) => id !== 'welcome')
  .map(
    (id) =>
      `WorkshopTourStep${id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')}`,
  );

// The Draw tour's steps, as drawTourStepTelemetryType makes them (apps/editor draw-tour-steps.ts,
// docs/specs/023-draw-mode/draw-tour.md). The welcome card sends no step view.
// The Sankey tour (docs/specs/007-editor/element-tours.md): its canvas steps, then the Flows dialog's Show Me steps
// it runs inside the dialog (each `flows-` prefixed), then its closing card.
const pascal = (id: string) =>
  id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
const SANKEY_TOUR_STEP_SOURCE: string[] = [
  ...[
    ...read('editor/components/tour/sankey-element-tour-steps.ts').matchAll(
      /canvasStep\(\s*'([a-z-]+)'/g,
    ),
  ].map((m) => m[1]!),
  ...[
    ...read('editor/components/tour/sankey-flows-tour-steps.ts').matchAll(/step\(\s*'([a-z-]+)'/g),
  ].map((m) => `flows-${m[1]!}`),
  'outro',
].map((id) => `SankeyTourStep${pascal(id)}`);

// A concept graphic's tour (docs/specs/007-editor/element-tours.md): its steps file's builders and any step of its own
// (`id: '…'`), then its closing card.
const conceptTourSteps = (token: string, file: string): string[] =>
  [
    ...[
      ...read(`editor/components/tour/${file}`).matchAll(
        /(?:(?:onGraphic|addRowStep|inTheMenu|onCanvas|inDialog)\(\s*|menuStep\(\s*\w+,\s*|\bid: )'([a-z-]+)'/g,
      ),
    ].map((m) => m[1]!),
    'outro',
  ].map((id) => `${token}Step${pascal(id)}`);

// Every element tour (ElementTourHost runs them all): its token, from the registry, and its steps.
export const ELEMENT_TOUR_TOKENS: string[] = [
  ...read('editor/components/tour/element-tour-defs.ts').matchAll(/token: '(\w+)'/g),
].map((m) => m[1]!);

export const ELEMENT_TOUR_STEP_SOURCE: string[] = [
  ...SANKEY_TOUR_STEP_SOURCE,
  ...conceptTourSteps('LayerStackTour', 'layer-stack-tour-steps.ts'),
  ...conceptTourSteps('PyramidTour', 'pyramid-tour-steps.ts'),
  ...conceptTourSteps('FunnelTour', 'funnel-tour-steps.ts'),
  ...conceptTourSteps('CycleTour', 'cycle-tour-steps.ts'),
  ...conceptTourSteps('HubTour', 'hub-tour-steps.ts'),
  ...conceptTourSteps('OnionTour', 'onion-tour-steps.ts'),
  ...conceptTourSteps('TimelineTour', 'timeline-tour-steps.ts'),
  ...conceptTourSteps('ChevronsTour', 'chevrons-tour-steps.ts'),
  ...conceptTourSteps('MindMapTour', 'mind-node-tour-steps.ts'),
  ...conceptTourSteps('FlowchartTour', 'flowchart-tour-steps.ts'),
  ...conceptTourSteps('OrgChartTour', 'org-chart-tour-steps.ts'),
  ...conceptTourSteps('SequenceTour', 'sequence-tour-steps.ts'),
  ...conceptTourSteps('ChartTour', 'chart-tour-steps.ts'),
  ...conceptTourSteps('StackTour', 'stack-tour-steps.ts'),
  ...conceptTourSteps('EntityTour', 'entity-tour-steps.ts'),
  ...conceptTourSteps('LaneTour', 'lane-tour-steps.ts'),
  ...conceptTourSteps('BoundaryTour', 'boundary-tour-steps.ts'),
  ...conceptTourSteps('DiagramKeyTour', 'diagram-key-tour-steps.ts'),
  ...conceptTourSteps('PortalTour', 'portal-tour-steps.ts'),
];

const DRAW_TOUR_STEP_SOURCE: string[] = [
  ...read('editor/components/tour/draw-tour-steps.ts').matchAll(/^ {4}id: '([a-z-]+)',/gm),
]
  .map((m) => m[1]!)
  .filter((id) => id !== 'welcome')
  .map(
    (id) =>
      `DrawTourStep${id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')}`,
  );

// The Avatar tour's steps, as avatarTourStepTelemetryType makes them (apps/editor avatar-tour-steps.ts,
// docs/specs/008-canvas/avatar-tour.md). The welcome card sends no step view.
const AVATAR_TOUR_STEP_SOURCE: string[] = [
  ...read('editor/components/tour/avatar-tour-steps.ts').matchAll(/^ {4}id: '([a-z-]+)',/gm),
]
  .map((m) => m[1]!)
  .filter((id) => id !== 'welcome')
  .map(
    (id) =>
      `AvatarTourStep${id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')}`,
  );

const SLUGS = ['your-first-diagram', 'tips-format-painter', 'connect-ai-mcp'];
const SLUG_WHY = "a help article's telemetry id, one per registered article";
const THEMES = ['Default', 'Plum'];
const THEME_WHY = "themeTelemetryLabel(themeId): a built-in theme's label (Default for none)";
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
  // The Explorer on liveworkspace.app, in this app's name: its closed token lists (../platform-emitters.ts).
  ...platformComputedEmitters(isValidTelemetryEvent),
  // Someone's first time in through a link, by its level (@liveworkspace/index-app JOINED_TELEMETRY_TYPE, the
  // same table as the api schema's).
  'apps/api/src/routes/internal-items.ts Document·Joined': {
    values: Object.values(LEVEL_TELEMETRY_TYPE),
  },
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
  'packages/help-site/src/components/ArticleShell.tsx Help·View': { values: SLUGS, open: SLUG_WHY },
  'packages/help-site/src/lib/use-article-vote.ts Help·Helpful': { values: SLUGS, open: SLUG_WHY },
  'packages/help-site/src/lib/use-article-vote.ts Help·Unhelpful': {
    values: SLUGS,
    open: SLUG_WHY,
  },

  // The Community app.
  'apps/community/lib/telemetry.ts Community·Reported': { values: COMMUNITY_REASON_TYPES },
  'apps/community/lib/telemetry.ts Community·Selected': { values: COMMUNITY_SELECTIONS },

  // Shared packages.
  'packages/telemetry-client/src/errors.ts Error·Client': {
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
  'apps/editor/app/document/[id]/useElementCreation.ts Element·Added': {
    values: ELEMENT_KINDS,
    open: ELEMENT_WHY,
  },
  'apps/editor/app/document/[id]/useSlideDeck.ts UI·Changed': { values: PRESENTATION_FIELDS },
  'apps/editor/components/dialogs/settings/settings-catalogue.ts UI·Toggled': {
    values: PRESENTATION_SETTINGS.toggled,
  },
  'apps/editor/components/dialogs/settings/settings-catalogue.ts UI·Changed': {
    values: PRESENTATION_SETTINGS.changed,
  },
  'apps/editor/app/document/[id]/useTemplateFlow.ts Template·Used': {
    values: TEMPLATES,
    open: TEMPLATE_WHY,
  },
  'apps/editor/app/document/[id]/useDocumentTrashed.ts Trash·Restored': { values: TRASH_TYPES },
  // The shared Explorer's Timeline, through ExplorerHost's onTimeline prop (@liveworkspace/explorer TimelinePane.tsx):
  // each a fixed token from the package.
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Timeline·Changed': {
    values: ['List', 'Calendar'],
  },
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Timeline·Selected': {
    values: [
      'Everyone',
      'Others',
      'new',
      'edits',
      'renames',
      'deletions',
      'sharing',
      'filing',
      'favourites',
      'other',
    ],
  },
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Timeline·Loaded': { values: ['More', 'Retry'] },
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Timeline·Opened': {
    values: ['Card', 'Stack', 'Menu'],
  },
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Timeline·Removed': {
    values: ['Entry', 'Stack'],
  },
  // Home's What Happened, through the Explorer's onHome prop (@liveworkspace/explorer WhatHappened.tsx).
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Home·Selected': {
    values: ['WhatHappened', 'SeeTimeline'],
  },
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Home·Opened': { values: ['Group'] },
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Home·Loaded': {
    values: EXPLORER_TELEMETRY_EVENTS['Home·Loaded'],
  },
  // The filter lens, through the Explorer's onLensSelected prop.
  'apps/editor/app/embed/workbench/ExplorerHost.tsx Explorer·Selected': { values: LENS_FACETS },
  // The Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry"):
  // the inbound change types and the Open with outcomes, read from their unions.
  'apps/editor/lib/drive/browser-engine.ts Drive·Applied': { values: DRIVE_INBOUND_TYPES },
  'apps/editor/components/drive/DriveOpen.tsx Drive·Opened': { values: DRIVE_OPEN_WITH_TYPES },
  'apps/editor/app/new/page.tsx Theme·Changed': { values: THEMES, open: THEME_WHY },
  'apps/editor/app/new/page.tsx Template·Used': { values: TEMPLATES, open: TEMPLATE_WHY },
  // Publishing to the Community: the post's category, as communityCategoryType.
  'apps/editor/components/dialogs/community/CommunityPublishDialog.tsx Community·Shared': {
    values: COMMUNITY_CATEGORY_TYPES,
  },
  'apps/editor/components/dialogs/community/CommunityPublishDialog.tsx Community·Changed': {
    values: COMMUNITY_CATEGORY_TYPES,
  },
  // The landing funnel (docs/specs/019-marketing/landing-funnel.md): the CTA a /new visit came from.
  'apps/editor/app/new/useCtaAttribution.ts Cta·Opened': { values: ALL_CTA_SOURCES },
  'apps/editor/app/new/useCtaAttribution.ts Cta·Created': { values: ALL_CTA_SOURCES },
  'apps/editor/components/dialogs/SettingsDialog.tsx UI·Opened': {
    values: ['SettingsAppearance', 'SettingsEditor', 'SettingsAccount', 'SettingsPrivacy'],
    open: 'Settings<Category>, one per Settings category',
  },
  'apps/editor/components/notes/useNoteRichTextSession.ts Note·Used': {
    values: ['Bold', 'Italic', 'List', 'Heading'],
    open: 'the rich-text command a note applied',
  },
  'apps/editor/components/palette/PaletteCategoryBrowser.tsx UI·Searched': {
    values: ['IconSearch', 'TechSearch', 'StickerSearch'],
  },
  'apps/editor/components/palette/PaletteCategoryBrowser.tsx UI·Opened': {
    values: ['IconGroup', 'TechGroup', 'StickerGroup'],
  },
  'apps/editor/components/panels/SearchPanel.tsx UI·Opened': { values: SLUGS, open: SLUG_WHY },
  'apps/editor/components/panels/SearchPanel.tsx Search·Selected': {
    values: ['Document', 'Shared', 'Folder', 'Team', 'Tab', 'Element', 'Palette', 'Command'],
  },
  'apps/editor/hooks/ui/useImageSearch.ts Error·Warning': {
    values: IMAGE_SEARCH_WARNINGS,
  },
  'apps/editor/components/primitives/AreaErrorBoundary.tsx Error·Client': {
    values: ['Render.Canvas.TypeError', 'Render.Header.Error'],
    open: 'Render.<Area>.<ErrorName>',
  },
  'apps/editor/components/primitives/HelpArticleLink.tsx UI·Opened': {
    values: SLUGS,
    open: SLUG_WHY,
  },
  // Load recovery (docs/specs/007-editor/load-recovery.md): the watchdog's warnings, and a throw in
  // the load named by its error.
  'apps/editor/app/document/[id]/useIdentityBootstrap.ts Error·Warning': {
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
  'apps/editor/app/document/[id]/useIdentityBootstrap.ts Error·Client': {
    values: ['DocumentLoad.TypeError', 'DocumentLoad.Error'],
    open: 'DocumentLoad.<ErrorName>',
  },
  'apps/editor/components/providers/ErrorTelemetryBoot.tsx Error·Warning': {
    values: ['OfflineStore.Unavailable', 'SessionToken.TimedOut'],
  },
  'apps/editor/components/providers/ErrorTelemetryBoot.tsx Error·Api': {
    values: API_ERRORS,
    open: API_ERROR_WHY,
  },
  'apps/editor/components/tour/WorkshopTourHost.tsx UI·View': {
    values: WORKSHOP_TOUR_STEP_SOURCE,
  },
  'apps/editor/components/tour/DrawTourHost.tsx UI·View': { values: DRAW_TOUR_STEP_SOURCE },
  'apps/editor/components/tour/ElementTourHost.tsx UI·View': { values: ELEMENT_TOUR_STEP_SOURCE },
  'apps/editor/components/tour/ElementTourHost.tsx UI·Started': { values: ELEMENT_TOUR_TOKENS },
  'apps/editor/components/tour/ElementTourHost.tsx UI·Ended': {
    values: ELEMENT_TOUR_TOKENS.flatMap((t) => [`${t}Completed`, `${t}Skipped`]),
  },
  'apps/editor/components/tour/ElementTourHost.tsx UI·Opened': {
    values: ELEMENT_TOUR_TOKENS.map((t) => `${t}Offer`),
  },
  'apps/editor/components/tour/AvatarTourHost.tsx UI·View': { values: AVATAR_TOUR_STEP_SOURCE },
  'apps/editor/components/tour/TourHost.tsx UI·View': { values: TOUR_STEP_SOURCE },
  'apps/editor/hooks/canvas/commit-freehand.ts Element·Added': {
    values: ['Square', 'Circle', 'Diamond', 'Triangle'],
    open: 'the shape the Shape Pen recognised',
  },
  'apps/editor/hooks/canvas/useDebouncedCanvasTelemetry.ts Canvas·Changed': {
    values: Object.keys(CANVAS_CONTROLS),
  },
  'apps/editor/hooks/canvas/usePhotoDraft.ts AI·Used': { values: PHOTO_DETECTORS },
  'apps/editor/hooks/canvas/useShapeDrawing.ts Element·Added': {
    values: ['Banner', 'Callout', 'Image', 'Video', 'LinkCard'],
    open: 'a drawn component or media kind',
  },
  'apps/editor/hooks/canvas/useTabCanvas.ts Tab·Aligned': {
    values: ['Smart', 'FlowchartDown', 'FlowchartRight', 'Tree', 'Mindmap'],
  },
  'apps/editor/hooks/canvas/useTabCanvas.ts Canvas·Changed': {
    values: ['Blank', 'Grid', 'Dots', 'Graph'],
    open: 'titleCaseType(pattern): a background pattern',
  },
  'apps/editor/hooks/canvas/useTabTheme.ts Theme·Changed': { values: THEMES, open: THEME_WHY },
  'apps/editor/hooks/canvas/useStylePreview.ts Element·Changed': {
    // The types the element menu's generic style ops pass through it (apps/editor/lib/element-style-ops.ts): the
    // accent edge, card slots and chip looks.
    values: [
      'AccentEdge',
      'CardSlots',
      'ChipLook',
      'ChipDetach',
      'BoundaryStyle',
      'BoundaryMeta',
      'PyramidVariant',
      'HubSpokes',
      'PointerDetach',
      'StackDirection',
      'StackColumns',
      'StackGap',
      'StackPadding',
      'StackAlign',
      'SequenceNumbered',
      'SequenceAnim',
      'ConceptAnim',
    ],
  },
  // The Sequence dialog's writes (apps/editor/hooks/canvas/useSequenceSetters.ts): which part of it changed.
  'apps/editor/hooks/canvas/useSequenceSetters.ts Element·Changed': {
    values: ['SequenceParticipants', 'SequenceMessages', 'SequenceText'],
  },
  // The element menu's whole-tab writes (apps/editor/lib/element-style-ops.ts `commitTab`).
  'apps/editor/components/palette/EditorContextMenuHost.tsx Element·Changed': {
    values: ['RenumberSteps', 'StepSequence'],
  },
  'apps/editor/hooks/canvas/useTextStyleSetters.ts Element·Toggled': {
    values: ['Bold', 'Italic', 'Underline', 'Strikethrough'],
  },
  'apps/editor/hooks/canvas/useWhiteboard.ts Draw·Selected': {
    values: ['Main', 'Second', 'Third'],
    open: 'penTelemetryType: the place of the pen in the dock, never its colour',
  },
  'apps/editor/hooks/canvas/useWebComponentSetters.ts Element·Changed': {
    values: ['Banner', 'Callout', 'StatRow'],
    open: 'elementTelemetryType of the web component a row was added to',
  },
  'apps/editor/hooks/ui/useAppearance.ts UI·Toggled': { values: APPEARANCE_LABELS },
  // The Share dialog's reports, through its onTelemetry prop (@liveworkspace/explorer ShareDialog.tsx): each a fixed
  // token from the package; a pass issued reports its level.
  'apps/editor/lib/explorer-share-host.ts Document·Shared': {
    values: EXPLORER_TELEMETRY_EVENTS['Document·Shared'],
  },
  // Folders, default folders, the Trash, through the Explorer's onOrganise prop (lib/explorer-organise.ts): the
  // Explorer's closed list.
  'apps/editor/lib/explorer-organise.ts Folder·Created': {
    values: EXPLORER_TELEMETRY_EVENTS['Folder·Created'],
  },
  'apps/editor/lib/explorer-organise.ts Folder·Moved': {
    values: EXPLORER_TELEMETRY_EVENTS['Folder·Moved'],
  },
  'apps/editor/lib/explorer-organise.ts Folder·Deleted': {
    values: EXPLORER_TELEMETRY_EVENTS['Folder·Deleted'],
  },
  'apps/editor/lib/explorer-organise.ts Folder·Changed': {
    values: EXPLORER_TELEMETRY_EVENTS['Folder·Changed'],
  },
  'apps/editor/lib/explorer-organise.ts Folder·Cleared': {
    values: EXPLORER_TELEMETRY_EVENTS['Folder·Cleared'],
  },
  'apps/editor/lib/explorer-organise.ts Trash·Restored': {
    values: EXPLORER_TELEMETRY_EVENTS['Trash·Restored'],
  },
  'apps/editor/lib/explorer-organise.ts Trash·Deleted': {
    values: EXPLORER_TELEMETRY_EVENTS['Trash·Deleted'],
  },
  'apps/editor/lib/explorer-organise.ts Trash·Cleared': {
    values: EXPLORER_TELEMETRY_EVENTS['Trash·Cleared'],
  },
  'apps/editor/lib/explorer-share-host.ts UI·Copied': {
    values: ['ShareLink', 'EmbedCode', 'LiveImage'],
  },
  'apps/editor/lib/explorer-share-host.ts Document·Removed': { values: ['ShareLink'] },
  'apps/editor/lib/explorer-share-host.ts UI·Selected': { values: ['LiveImageTab'] },
  'apps/editor/lib/explorer-share-host.ts UI·Started': { values: ['ShareTour'] },
  'apps/editor/lib/explorer-share-host.ts UI·Ended': {
    values: ['ShareTourCompleted', 'ShareTourSkipped'],
  },
  // The Inbox's reports, through its onTelemetry prop (@liveworkspace/explorer InboxPane.tsx, inbox/InboxRows.tsx).
  'apps/editor/lib/explorer-inbox-host.tsx Activity·Opened': { values: [null] },
  'apps/editor/lib/explorer-inbox-host.tsx Activity·Selected': {
    values: ['Action', 'Card', 'Thread', 'CardThread', 'FormResponses'],
  },
  'apps/editor/lib/explorer-inbox-host.tsx Activity·Loaded': { values: ['Retry'] },
  'apps/editor/lib/element-telemetry.ts Element·Duplicated': { values: [null, 'ShiftDrag'] },
  'apps/editor/lib/element-telemetry.ts Element·Added': {
    values: ELEMENT_KINDS,
    open: ELEMENT_WHY,
  },
  // Timings (docs/specs/017-telemetry/timing-telemetry.md): every editor timing and every app's Web
  // Vitals go through the one reportTiming, so this one site sends every metric in every bucket.
  'packages/telemetry-client/src/timing.ts Timing·Measured': { values: ALL_TIMING_TYPES },
};
