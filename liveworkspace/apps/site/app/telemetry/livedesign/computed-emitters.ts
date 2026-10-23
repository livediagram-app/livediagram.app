// Test support for metric-emitters.test.ts: the values each COMPUTED emitter
// can send. The emitter scan (emitter-scan.ts) knows a computed emit site
// exists but not what its type will be, and "some chart counts this
// category·action" is not enough: `UI·Changed·Presentation-<field>` sat on
// no chart at all, unseen because a chart existed on the pair.
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
  LEVEL_TELEMETRY_TYPE,
  PLACEMENT_DEFAULT_KEYS,
  pascalToken,
  placementDefaultTelemetryType,
} from '@livedesign/api-schema';
import { countedVerbs } from '@livedesign/agent-verbs';
import { MCP_TOOL_VERBS } from '@livedesign/agent-verbs/mcp';
import { CANVAS_CONTROLS } from './event-vocab';
import { ADJUSTMENT_IDS, FILTERS, LAYER_ADJUSTMENT_IDS } from '@livedesign/photo-engine';

type ComputedValues = {
  values: readonly (string | null)[];
  // Why the list is samples rather than the whole set. Unset: it is the set.
  open?: string;
};

const APPS = resolve(__dirname, '../../../../../../livedesign/apps');
const read = (path: string) => readFileSync(resolve(APPS, path), 'utf8');

function tokensAfterBlock(path: string, marker: string, close: string): string[] {
  const source = read(path);
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const block = source.slice(start, source.indexOf(close, start + marker.length));
  return [...block.matchAll(/'([A-Za-z0-9-]+)'/g)].map((m) => m[1]!);
}

const pascalOf = (id: string) => id.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase());

// The photo tools, as the editor names them (apps/live/lib/photo-editor/tool-state.ts TOOL_NAMES' keys).
const PHOTO_TOOLS = tokensAfterBlock(
  'live/lib/photo-editor/tool-state.ts',
  'export type PhotoToolId',
  ';',
);
// The layer operations photo-actions.ts counts, `PhotoLayer<Operation>`.
const PHOTO_LAYER_OPS = [
  'New',
  'NewGroup',
  'ViaCopy',
  'Duplicate',
  'Delete',
  'Group',
  'Ungroup',
  'MergeDown',
  'MergeVisible',
  'Flatten',
  'Clip',
  'AddMask',
  'ApplyMask',
  'DeleteMask',
  'ToggleMask',
  'InvertMask',
  'Rasterize',
  'ViaCut',
];

// Every quoted token in the first block that follows `marker`.
function tokensAfter(source: string, marker: string, close: string): string[] {
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const block = source.slice(start, source.indexOf(close, start + marker.length));
  return [...block.matchAll(/'([A-Za-z0-9-]+)'/g)].map((m) => m[1]!);
}

// The api's email templates: `export type EmailKind = 'Welcome' | ...;`.
const EMAIL_KINDS = tokensAfter(read('api/src/email/templates.ts'), 'export type EmailKind', ';');

// The verbs the CLI counts (packages/agent-verbs), as their `Cli·Used` types.
const CLI_VERBS = countedVerbs().map((v) => pascalToken(v.id));

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

// The Settings dialog's presenter rows (settings-catalogue.ts presentingToggle / presentingChoice): a toggle sends
// `Presentation-<field>On|Off` for each boolean field, a choice `Presentation-<field><Option>` (choiceTelemetryType).
const PRESENTATION_SETTINGS = (() => {
  const source = read('live/lib/presentation-config.ts');
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

// The image picker's search failures (apps/live image-search/telemetry.ts):
// every `ImageSearch.<Reason>` token in its fixed tables.
const IMAGE_SEARCH_WARNINGS = [
  ...new Set(
    [...read('live/lib/image-search/telemetry.ts').matchAll(/'(ImageSearch\.[A-Za-z.]+)'/g)].map(
      (m) => m[1]!,
    ),
  ),
];

// The Sankey tour (docs/specs/007-editor/element-tours.md): its canvas steps, then the Flows dialog's Show Me steps
// it runs inside the dialog (each `flows-` prefixed), then its closing card.
const pascal = (id: string) =>
  id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
const SANKEY_TOUR_STEP_SOURCE: string[] = [
  ...[
    ...read('live/components/tour/sankey-element-tour-steps.ts').matchAll(
      /canvasStep\(\s*'([a-z-]+)'/g,
    ),
  ].map((m) => m[1]!),
  ...[
    ...read('live/components/tour/sankey-flows-tour-steps.ts').matchAll(/step\(\s*'([a-z-]+)'/g),
  ].map((m) => `flows-${m[1]!}`),
  'outro',
].map((id) => `SankeyTourStep${pascal(id)}`);

// A concept graphic's tour (docs/specs/007-editor/element-tours.md): its steps file's builders and any step of its own
// (`id: '…'`), then its closing card.
const conceptTourSteps = (token: string, file: string): string[] =>
  [
    ...[
      ...read(`live/components/tour/${file}`).matchAll(
        /(?:(?:onGraphic|addRowStep|inTheMenu|onCanvas|inDialog)\(\s*|menuStep\(\s*\w+,\s*|\bid: )'([a-z-]+)'/g,
      ),
    ].map((m) => m[1]!),
    'outro',
  ].map((id) => `${token}Step${pascal(id)}`);

// Every element tour (ElementTourHost runs them all): its token, from the registry, and its steps.
export const ELEMENT_TOUR_TOKENS: string[] = [
  ...read('live/components/tour/element-tour-defs.ts').matchAll(/token: '(\w+)'/g),
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
  ...conceptTourSteps('ChartTour', 'chart-tour-steps.ts'),
  ...conceptTourSteps('StackTour', 'stack-tour-steps.ts'),
  ...conceptTourSteps('TabWindowTour', 'tab-window-tour-steps.ts'),
];

// The Pages tour's steps, as pagesTourStepTelemetryType makes them (apps/live PagesTourHost.tsx,
// docs/specs/007-editor/pages-tour.md): each page kind's track names its kind before the step. The welcome card
// sends no step view.
const camel = (id: string) =>
  id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
const PAGES_TOUR_STEP_SOURCE: string[] = (['wireframe', 'logo'] as const).flatMap((kind) =>
  [...read(`live/components/tour/${kind}-tour-steps.ts`).matchAll(/^ +id: '([a-z-]+)',/gm)]
    .map((m) => m[1]!)
    .filter((id, i, ids) => id !== 'welcome' && ids.indexOf(id) === i)
    .map((id) => `PagesTourStep${camel(`${kind}-${id}`)}`),
);

const SLUGS = ['your-first-diagram', 'tips-format-painter', 'connect-ai-mcp'];
const SLUG_WHY = "a help article's telemetry id, one per registered article";
const THEMES = ['Default', 'Plum', 'Unknown'];
const THEME_WHY = "themeTelemetryLabel(themeId): a built-in theme's label, or Unknown";
const TEMPLATES = ['Article', 'SlideDeck', 'LogoDesign'];
const TEMPLATE_WHY = "titleCaseType(kind): a template's kind";
const ELEMENT_KINDS = ['Square', 'Circle', 'Sticky', 'Icon', 'TechIcon', 'Banner', 'Video'];
const ELEMENT_WHY = 'an element kind, as the palette catalogue spells it';
const API_ERRORS = [
  'Http403.LoadTab.Forbidden',
  'Http500.SaveTab',
  'Network.Put.Designs.Tabs',
  'Auth.NoSessionToken',
  'SaveFailed.TypeError',
];
const API_ERROR_WHY = 'a status or kind plus the request that failed, and the worker error token';

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
    values: ['Internal.Put.Designs.Tabs', 'Internal.Get.Designs'],
    open: 'Internal.<Method>.<Route>, the route the worker was serving',
  },

  // The CLI (apps/cli).
  'apps/cli/src/telemetry.ts Cli·Used': { values: CLI_VERBS },
  'apps/cli/src/telemetry.ts Error·Api': {
    values: ['Http503.TabView', 'Internal.DesignLs'],
    open: 'a status or Internal, plus the command that failed',
  },

  // The MCP worker.
  'apps/mcp/src/tool-annotations.ts Mcp·Used': { values: MCP_TOOLS },
  'apps/mcp/src/api.ts Error·Api': {
    values: ['Http503.CreateDesign', 'Internal.ReadDesign'],
    open: 'a status or Internal, plus the tool that failed',
  },

  // The help centre.
  'apps/help/components/ArticleShell.tsx Help·View': { values: SLUGS, open: SLUG_WHY },
  'apps/help/components/useArticleVote.ts Help·Helpful': { values: SLUGS, open: SLUG_WHY },
  'apps/help/components/useArticleVote.ts Help·Unhelpful': { values: SLUGS, open: SLUG_WHY },

  // Shared packages.
  'packages/telemetry-client/src/index.ts Error·Client': {
    values: ['Uncaught.Design.TypeError', 'UnhandledRejection.Explorer.Error'],
    open: 'a kind, the page it happened on, and the error name',
  },
  'packages/ui/src/PageViewTracker.tsx Page·View': {
    values: ['/', '/design', '/explorer/timeline', '/help/canvas/links', '/telemetry'],
    open: 'the page path, ids and query strings stripped',
  },

  // The editor.
  'apps/live/app/design/[id]/useElementCreation.ts Element·Added': {
    values: ELEMENT_KINDS,
    open: ELEMENT_WHY,
  },
  'apps/live/app/design/[id]/useSlideDeck.ts UI·Changed': { values: PRESENTATION_FIELDS },
  'apps/live/components/dialogs/settings/settings-catalogue.ts UI·Toggled': {
    values: PRESENTATION_SETTINGS.toggled,
  },
  'apps/live/components/dialogs/settings/settings-catalogue.ts UI·Changed': {
    values: PRESENTATION_SETTINGS.changed,
  },
  'apps/live/app/design/[id]/useTemplateFlow.ts Template·Used': {
    values: TEMPLATES,
    open: TEMPLATE_WHY,
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
  // telemetryType, the one closed set every site sends.
  'apps/live/hooks/persistence/useTrash.ts Trash·Restored': { values: TRASH_TYPES },
  'apps/live/hooks/persistence/useTrash.ts Trash·Deleted': { values: TRASH_TYPES },
  'apps/live/hooks/persistence/useTrash.ts Trash·Cleared': { values: TRASH_TYPES },
  'apps/live/app/design/[id]/useDesignTrashed.ts Trash·Restored': { values: TRASH_TYPES },
  // A delete toast's Undo (lib/design-delete-undo.ts DeletedTrash, the same three).
  'apps/live/lib/design-delete-undo.ts Trash·Restored': { values: TRASH_TYPES },
  'apps/live/app/explorer/sidebar/sidebar-telemetry.ts UI·Selected': { values: SIDEBAR_ROWS },
  // Default folders (docs/specs/013-workspace/default-folders.md "Telemetry"): one value per key.
  'apps/live/lib/placement-defaults/placement-defaults-store.ts Folder·Changed': {
    values: DEFAULT_FOLDER_TYPES,
  },
  'apps/live/lib/placement-defaults/placement-defaults-store.ts Folder·Cleared': {
    values: DEFAULT_FOLDER_TYPES,
  },
  'apps/live/app/explorer/lens/lens-telemetry.ts Explorer·Selected': { values: LENS_FACETS },
  'apps/live/app/new/page.tsx Theme·Changed': { values: THEMES, open: THEME_WHY },
  'apps/live/app/new/page.tsx Template·Used': { values: TEMPLATES, open: TEMPLATE_WHY },
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
    values: ['Design', 'Shared', 'Folder', 'Team', 'Tab', 'Element', 'Palette', 'Command'],
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
  'apps/live/app/design/[id]/useIdentityBootstrap.ts Error·Warning': {
    values: [
      'DesignLoad.TimedOut.Identity',
      'DesignLoad.TimedOut.Participant',
      'DesignLoad.TimedOut.Design',
      'DesignLoad.TimedOut.Share',
      'DesignLoad.TimedOut.FirstTab',
      'DesignLoad.AutoReload',
      'DesignLoad.Late',
    ],
  },
  'apps/live/app/design/[id]/useIdentityBootstrap.ts Error·Client': {
    values: ['DesignLoad.TypeError', 'DesignLoad.Error'],
    open: 'DesignLoad.<ErrorName>',
  },
  'apps/live/components/providers/ErrorTelemetryBoot.tsx Error·Warning': {
    values: ['OfflineStore.Unavailable', 'SessionToken.TimedOut'],
  },
  'apps/live/components/providers/ErrorTelemetryBoot.tsx Error·Api': {
    values: API_ERRORS,
    open: API_ERROR_WHY,
  },
  'apps/live/components/tour/ElementTourHost.tsx UI·View': { values: ELEMENT_TOUR_STEP_SOURCE },
  'apps/live/components/tour/ElementTourHost.tsx UI·Started': { values: ELEMENT_TOUR_TOKENS },
  'apps/live/components/tour/ElementTourHost.tsx UI·Ended': {
    values: ELEMENT_TOUR_TOKENS.flatMap((t) => [`${t}Completed`, `${t}Skipped`]),
  },
  'apps/live/components/tour/ElementTourHost.tsx UI·Opened': {
    values: ELEMENT_TOUR_TOKENS.map((t) => `${t}Offer`),
  },
  'apps/live/components/tour/ElementTourHost.tsx UI·Closed': {
    values: ELEMENT_TOUR_TOKENS.map((t) => `${t}Offer`),
  },
  'apps/live/components/tour/PagesTourHost.tsx UI·View': {
    values: PAGES_TOUR_STEP_SOURCE,
  },
  'apps/live/hooks/canvas/commit-freehand.ts Element·Added': {
    values: ['Square', 'Circle', 'Diamond', 'Triangle'],
    open: 'the shape the Shape Pen recognised',
  },
  'apps/live/hooks/canvas/useDebouncedCanvasTelemetry.ts Canvas·Changed': {
    values: Object.keys(CANVAS_CONTROLS),
  },
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
  // A photo page (docs/specs/031-photo/photo-pages.md "Telemetry"): each tool's use, each adjustment and filter
  // applied, each layer operation, each panel tab and export format, from their catalogues.
  'apps/live/components/photo/PhotoCanvasOverlays.tsx Element·Used': {
    values: PHOTO_TOOLS.map((t) => `Photo${pascalOf(t)}`),
  },
  'apps/live/components/photo/PhotoAdjustTab.tsx Element·Changed': {
    values: LAYER_ADJUSTMENT_IDS.map((id) => `PhotoAdjust${pascalOf(id)}`),
  },
  'apps/live/components/photo/PhotoApplyDialogs.tsx Element·Changed': {
    values: [
      ...Object.keys(FILTERS).map((id) => `PhotoFilter${pascalOf(id)}`),
      ...ADJUSTMENT_IDS.map((id) => `PhotoAdjust${pascalOf(id)}`),
    ],
  },
  'apps/live/components/photo/PhotoLayerAddMenus.tsx Element·Changed': {
    values: [
      ...LAYER_ADJUSTMENT_IDS.map((id) => `PhotoAdjust${pascalOf(id)}`),
      'PhotoLayerEffectDropShadow',
      'PhotoLayerEffectOuterGlow',
      'PhotoLayerEffectStroke',
      'PhotoLayerEffectColourOverlay',
    ],
  },
  'apps/live/lib/photo-editor/photo-actions.ts Element·Changed': {
    values: [
      'PhotoAutoTone',
      'PhotoAutoContrast',
      'PhotoAutoColour',
      ...PHOTO_LAYER_OPS.map((op) => `PhotoLayer${op}`),
      ...Object.keys(FILTERS).map((id) => `PhotoFilter${pascalOf(id)}`),
    ],
  },
  'apps/live/components/photo/PhotoPanel.tsx UI·Opened': {
    values: ['PhotoPanelLayers', 'PhotoPanelAdjust', 'PhotoPanelHistory'],
  },
  'apps/live/components/photo/PhotoExportPanel.tsx Document·Exported': {
    values: ['PhotoPng', 'PhotoJpeg', 'PhotoWebp', 'PhotoPsd', 'PhotoLayers'],
  },
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
    // The wordmark fields, and the types the element menu's generic style ops pass through it
    // (apps/live/lib/element-style-ops.ts): the accent edge, card slots and chip looks.
    values: [
      'TextTracking',
      'TextWeight',
      'TextCase',
      'TextArc',
      'AccentEdge',
      'CardSlots',
      'ChipLook',
      'ChipDetach',
      'PyramidVariant',
      'HubSpokes',
      'PointerDetach',
      'StackDirection',
      'StackColumns',
      'StackGap',
      'StackPadding',
      'StackAlign',
      'ConceptAnim',
    ],
  },
  // The element menu's whole-tab writes (apps/live/lib/element-style-ops.ts `commitTab`).
  'apps/live/components/palette/EditorContextMenuHost.tsx Element·Changed': {
    values: ['RenumberSteps', 'StepSequence'],
  },
  'apps/live/hooks/canvas/useTextStyleSetters.ts Element·Toggled': {
    values: ['Bold', 'Italic', 'Underline', 'Strikethrough'],
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
