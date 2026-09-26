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
import { ALL_CTA_SOURCES, pascalToken } from '@livediagram/api-schema';
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

// The api's email templates: `export type EmailKind = 'Welcome' | ...;`.
const EMAIL_KINDS = tokensAfter(read('api/src/email/templates.ts'), 'export type EmailKind', ';');

// Each tool the MCP server registers, as pascalToken(name).
const MCP_TOOLS = [
  ...read('mcp/src/tools.ts').matchAll(/registerTool\(\s*server,\s*env,\s*'([a-z_]+)'/g),
].map((m) => pascalToken(m[1]!));

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
  'Network.Put.Diagrams.Tabs',
  'Auth.NoSessionToken',
  'SaveFailed.TypeError',
];
const API_ERROR_WHY = 'a status or kind plus the request that failed, and the worker error token';

export const COMPUTED_EMITTERS: Record<string, ComputedValues> = {
  // The api worker.
  'apps/api/src/email/client.ts Email·Sent': { values: EMAIL_KINDS },
  'apps/api/src/email/client.ts Error·Api': {
    values: ['Http500.SendEmail', 'Http429.SendEmail'],
    open: 'Http<status>.SendEmail, any status Resend answers',
  },
  'apps/api/src/index.ts Error·Api': {
    values: ['Internal.Put.Diagrams.Tabs', 'Internal.Get.Diagrams'],
    open: 'Internal.<Method>.<Route>, the route the worker was serving',
  },

  // The MCP worker.
  'apps/mcp/src/tool-annotations.ts Mcp·Used': { values: MCP_TOOLS },
  'apps/mcp/src/api.ts Error·Api': {
    values: ['Http503.CreateDiagram', 'Internal.ReadDiagram'],
    open: 'a status or Internal, plus the tool that failed',
  },

  // The help centre.
  'apps/help/components/ArticleLayout.tsx Help·View': { values: SLUGS, open: SLUG_WHY },
  'apps/help/components/useArticleVote.ts Help·Helpful': { values: SLUGS, open: SLUG_WHY },
  'apps/help/components/useArticleVote.ts Help·Unhelpful': { values: SLUGS, open: SLUG_WHY },

  // Shared packages.
  'packages/telemetry-client/src/index.ts Error·Client': {
    values: ['Uncaught.Diagram.TypeError', 'UnhandledRejection.Explorer.Error'],
    open: 'a kind, the page it happened on, and the error name',
  },
  'packages/ui/src/PageViewTracker.tsx Page·View': {
    values: ['/', '/diagram', '/explorer/timeline', '/help/canvas/links', '/telemetry'],
    open: 'the page path, ids and query strings stripped',
  },

  // The editor.
  'apps/live/app/diagram/[id]/useElementCreation.ts Element·Added': {
    values: ELEMENT_KINDS,
    open: ELEMENT_WHY,
  },
  'apps/live/app/diagram/[id]/useSlideDeck.ts UI·Changed': { values: PRESENTATION_FIELDS },
  'apps/live/app/diagram/[id]/useTemplateFlow.ts Template·Used': {
    values: TEMPLATES,
    open: TEMPLATE_WHY,
  },
  'apps/live/app/diagram/[id]/useTemplateFlow.ts Theme·Changed': {
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
    values: ['BehaviourSearch', 'IconSearch', 'TechSearch', 'StickerSearch'],
  },
  'apps/live/components/palette/PaletteCategoryBrowser.tsx UI·Opened': {
    values: ['BehaviourGroup', 'IconGroup', 'TechGroup', 'StickerGroup'],
  },
  'apps/live/components/panels/SearchPanel.tsx UI·Opened': { values: SLUGS, open: SLUG_WHY },
  'apps/live/components/panels/SearchPanel.tsx Search·Selected': {
    values: ['Diagram', 'Shared', 'Folder', 'Team', 'Tab', 'Element', 'Palette', 'Command'],
  },
  'apps/live/components/panels/useTeamPaneActions.ts Team·Removed': {
    values: ['Invite', 'Member', 'Self'],
  },
  'apps/live/components/primitives/AreaErrorBoundary.tsx Error·Client': {
    values: ['Render.Canvas.TypeError', 'Render.Header.Error'],
    open: 'Render.<Area>.<ErrorName>',
  },
  'apps/live/components/primitives/HelpArticleLink.tsx UI·Opened': {
    values: SLUGS,
    open: SLUG_WHY,
  },
  'apps/live/components/providers/ErrorTelemetryBoot.tsx Error·Api': {
    values: API_ERRORS,
    open: API_ERROR_WHY,
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
  'apps/live/hooks/canvas/useTextStyleSetters.ts Element·Toggled': {
    values: ['Bold', 'Italic', 'Underline', 'Strikethrough'],
  },
  'apps/live/hooks/canvas/useWebComponentSetters.ts Element·Changed': {
    values: ['Banner', 'Callout', 'StatRow'],
    open: 'elementTelemetryType of the web component a row was added to',
  },
  'apps/live/hooks/persistence/useShareLinks.ts Diagram·Shared': {
    values: ['ExpiryWeek', 'ExpiryMonth', 'ExpirySixMonths'],
  },
  'apps/live/lib/element-telemetry.ts Element·Duplicated': { values: [null, 'ShiftDrag'] },
  'apps/live/lib/element-telemetry.ts Element·Added': { values: ELEMENT_KINDS, open: ELEMENT_WHY },
};
