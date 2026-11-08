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
  PALETTE_TELEMETRY_TYPES,
  ALL_CTA_SOURCES,
  ALL_TIMING_TYPES,
  COMMUNITY_CATEGORIES,
  LEVEL_TELEMETRY_TYPE,
  isValidTelemetryEvent,
} from '@livehuddle/api-schema';
import { CANVAS_CONTROLS } from '../_shared/event-vocab';
import { EXPLORER_TELEMETRY_EVENTS } from '@liveworkspace/telemetry';

type ComputedValues = {
  values: readonly (string | null)[];
  // Why the list is samples rather than the whole set. Unset: it is the set.
  open?: string;
};

const APPS = resolve(__dirname, '../../../../../../livehuddle/apps');
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

// The Appearance settings' labels (@liveworkspace/ui appearance-cycle.ts), the
// editor's `UI·Toggled` type on an explicit pick.
const APPEARANCE_LABELS = tokensAfter(
  read('../../packages/ui/src/appearance/appearance-cycle.ts'),
  'export const APPEARANCE_LABEL',
  '};',
);

// The Trash a restored canvas sat in: useDocumentTrashed's `from`, Personal or Team.
const TRASH_TYPES = tokensAfter(
  read('editor/app/document/[id]/useDocumentTrashed.ts'),
  'const [from, setFrom] = useState<',
  '>',
);

// The image picker's search failures (apps/editor image-search/telemetry.ts):
// every `ImageSearch.<Reason>` token in its fixed tables.
const IMAGE_SEARCH_WARNINGS = [
  ...new Set(
    [...read('editor/lib/image-search/telemetry.ts').matchAll(/'(ImageSearch\.[A-Za-z.]+)'/g)].map(
      (m) => m[1]!,
    ),
  ),
];

const pascal = (id: string) =>
  id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

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
  ...conceptTourSteps('PortalTour', 'portal-tour-steps.ts'),
];

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
// Every kind the palette catalogue names, a category's or a retired one's (the api schema's PALETTE_TELEMETRY_TYPES).
const ELEMENT_KINDS = Object.values(PALETTE_TELEMETRY_TYPES).flat();
const ELEMENT_WHY = 'an element kind, as the palette catalogue spells it';
const API_ERRORS = [
  'Http403.LoadTab.Forbidden',
  'Http500.SaveTab',
  'Network.Put.Documents.Tabs',
  'Auth.NoSessionToken',
  'SaveFailed.TypeError',
];
const API_ERROR_WHY = 'a status or kind plus the request that failed, and the worker error token';

// The Community (docs/specs/025-community/community.md "Telemetry"): a post's category as its closed `type` token.
// The gallery's own events are liveworkspace.app's Community page's, each type literal there (platform-emitters.ts).
const COMMUNITY_CATEGORY_TYPES = COMMUNITY_CATEGORIES.map((c) => c.type);

// Where a changeset came from, read off the front door's own type so the list cannot drift.
const AGENT_FRONT_DOORS = tokensAfter(
  read('api/src/changesets/front-door.ts'),
  'export type FrontDoor =',
  ';',
);

// The UI Scale slider's per-part rows (settings-catalogue.ts uiScalePartRow), each naming its token in the copy
// it hands the helper, which builds the row's event from it.
const UI_SCALE_PARTS = [
  ...read('editor/components/dialogs/settings/settings-catalogue.ts').matchAll(
    /uiScalePartRow\('[A-Za-z]+', \{[^}]*?changed: '([A-Za-z]+)'/g,
  ),
].map((m) => m[1]!);

export const COMPUTED_EMITTERS: Record<string, ComputedValues> = {
  // The UI Scale slider's per-part rows (UI_SCALE_PARTS above).
  'apps/editor/components/dialogs/settings/settings-catalogue.ts UI·Changed': {
    values: UI_SCALE_PARTS,
  },
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
    open: '<code>.SendEmail, the code Email Service refuses with (Network when it has none)',
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

  // The help centre.
  'packages/help-site/src/components/ArticleShell.tsx Help·View': { values: SLUGS, open: SLUG_WHY },
  'packages/help-site/src/lib/use-article-vote.ts Help·Helpful': { values: SLUGS, open: SLUG_WHY },
  'packages/help-site/src/lib/use-article-vote.ts Help·Unhelpful': {
    values: SLUGS,
    open: SLUG_WHY,
  },

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
  'packages/ui/src/page-view-tracker.tsx Page·View': {
    values: [
      '/',
      '/document',
      '/explorer/timeline',
      '/help/canvas/links',
      '/telemetry',
      '/community',
    ],
    open: 'the page path, ids and query strings stripped',
  },

  // The editor.
  'apps/editor/app/document/[id]/useElementCreation.ts Element·Added': {
    values: ELEMENT_KINDS,
    open: ELEMENT_WHY,
  },
  'apps/editor/app/document/[id]/useTemplateFlow.ts Template·Used': {
    values: TEMPLATES,
    open: TEMPLATE_WHY,
  },
  'apps/editor/app/document/[id]/useDocumentTrashed.ts Trash·Restored': { values: TRASH_TYPES },
  'apps/editor/app/new/page.tsx Theme·Changed': { values: THEMES, open: THEME_WHY },
  'apps/editor/app/new/page.tsx Template·Used': { values: TEMPLATES, open: TEMPLATE_WHY },
  // Publishing to the Community: the post's category, as communityCategoryType.
  // Through the Share dialog's Community tab (@liveworkspace/community-ui), bound in lib/community-share-host.tsx.
  'apps/editor/lib/community-share-host.tsx Community·Shared': {
    values: COMMUNITY_CATEGORY_TYPES,
  },
  'apps/editor/lib/community-share-host.tsx Community·Changed': {
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
    values: [
      'Document',
      'Shared',
      'Folder',
      'Team',
      'Tab',
      'Element',
      'Palette',
      'Command',
      'Workspace',
    ],
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
  'apps/editor/components/tour/ElementTourHost.tsx UI·View': { values: ELEMENT_TOUR_STEP_SOURCE },
  'apps/editor/components/tour/ElementTourHost.tsx UI·Started': { values: ELEMENT_TOUR_TOKENS },
  'apps/editor/components/tour/ElementTourHost.tsx UI·Ended': {
    values: ELEMENT_TOUR_TOKENS.flatMap((t) => [`${t}Completed`, `${t}Skipped`]),
  },
  'apps/editor/components/tour/ElementTourHost.tsx UI·Opened': {
    values: ELEMENT_TOUR_TOKENS.map((t) => `${t}Offer`),
  },
  // The Timer and Stopwatch pieces (docs/specs/009-elements/timer-and-stopwatch.md): paused or reset, by kind.
  'apps/editor/components/canvas/collab/TimerView.tsx Element·Toggled': {
    values: ['TimerPaused', 'StopwatchPaused'],
  },
  'apps/editor/components/canvas/collab/TimerView.tsx Element·Changed': {
    values: ['TimerReset', 'StopwatchReset'],
  },
  // A note pinned or unpinned on a piece that holds notes (docs/specs/009-elements/team-pieces.md "Telemetry"), by
  // the piece: never the note, never who.
  'apps/editor/components/canvas/collab/useNoteSigner.ts Element·Changed': {
    values: ['Notice-board', 'Calendar-wall'],
  },
  'apps/editor/components/tour/AvatarTourHost.tsx UI·View': { values: AVATAR_TOUR_STEP_SOURCE },
  'apps/editor/hooks/canvas/useDebouncedCanvasTelemetry.ts Canvas·Changed': {
    values: Object.keys(CANVAS_CONTROLS),
  },
  'apps/editor/hooks/canvas/useShapeDrawing.ts Element·Added': {
    values: ['Banner', 'Callout', 'Image', 'Video', 'LinkCard'],
    open: 'a drawn component or media kind',
  },
  'apps/editor/hooks/canvas/useTabCanvas.ts Canvas·Changed': {
    values: ['Blank', 'Grid', 'Dots', 'Graph'],
    open: 'titleCaseType(pattern): a background pattern',
  },
  'apps/editor/hooks/canvas/useTabTheme.ts Theme·Changed': { values: THEMES, open: THEME_WHY },
  // A piece of furniture turned by Rotate Left or Rotate Right (docs/specs/009-elements/furniture-facing.md).
  'apps/editor/hooks/canvas/useDataShapeSetters.ts Element·Changed': {
    values: ['Sofa', 'Chair', 'Desk', 'Lockers', 'Meeting-table', 'Vending-machine'],
    open: 'shapeTelemetryToken of the turned piece: any furniture that turns',
  },
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
  // The element menu's whole-tab writes (apps/editor/lib/element-style-ops.ts `commitTab`).
  'apps/editor/components/palette/EditorContextMenuHost.tsx Element·Changed': {
    values: ['RenumberSteps', 'StepSequence'],
  },
  'apps/editor/hooks/canvas/useTextStyleSetters.ts Element·Toggled': {
    values: ['Bold', 'Italic', 'Underline', 'Strikethrough'],
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
  'apps/editor/lib/explorer-inbox-host.tsx Activity·Changed': {
    values: ['All', 'MyActions', 'AssignedByMe', 'Comments', 'FormResponses'],
  },
  'apps/editor/lib/explorer-inbox-host.tsx Activity·Added': { values: ['Reply'] },
  'apps/editor/lib/explorer-inbox-host.tsx Activity·Resolved': {
    values: ['Thread', 'Action', 'Card'],
  },
  'apps/editor/lib/element-telemetry.ts Element·Duplicated': { values: [null, 'ShiftDrag'] },
  'apps/editor/lib/element-telemetry.ts Element·Added': {
    values: ELEMENT_KINDS,
    open: ELEMENT_WHY,
  },
  // Timings (docs/specs/017-telemetry/timing-telemetry.md): every editor timing and every app's Web
  // Vitals go through the one reportTiming, so this one site sends every metric in every bucket.
  'packages/telemetry-client/src/timing.ts Timing·Measured': { values: ALL_TIMING_TYPES },
};
