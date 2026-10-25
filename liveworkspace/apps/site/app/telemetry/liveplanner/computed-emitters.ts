// Test support for metric-emitters.test.ts: the values each COMPUTED emitter
// can send. The emitter scan (emitter-scan.ts) knows a computed emit site
// exists but not what its type will be, and "some chart counts this
// category·action" is not enough: a computed type can sit on no chart at all, unseen because a chart
// existed on the pair.
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
import { EXPLORER_TELEMETRY_EVENTS } from '@liveworkspace/telemetry';
import { platformComputedEmitters } from '../platform-emitters';
import {
  ALL_CTA_SOURCES,
  ALL_TIMING_TYPES,
  LEVEL_TELEMETRY_TYPE,
  SHEET_CHANGE_KINDS,
  pascalToken,
  isValidTelemetryEvent,
} from '@liveplanner/api-schema';
import { countedVerbs } from '@liveplanner/agent-verbs';
import { FORM_STARTERS, QUESTION_TYPE_TELEMETRY } from '@liveplanner/forms';
import { MCP_TOOL_VERBS } from '@liveplanner/agent-verbs/mcp';
import { CANVAS_CONTROLS } from '../_shared/event-vocab';

type ComputedValues = {
  values: readonly (string | null)[];
  // Why the list is samples rather than the whole set. Unset: it is the set.
  open?: string;
};

const APPS = resolve(__dirname, '../../../../../../liveplanner/apps');
const read = (path: string) => readFileSync(resolve(APPS, path), 'utf8');

// Every quoted token in the first block that follows `marker`.
function tokensAfter(source: string, marker: string, close: string): string[] {
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const block = source.slice(start, source.indexOf(close, start + marker.length));
  return [...block.matchAll(/'([A-Za-z0-9-]+)'/g)].map((m) => m[1]!);
}

// The Explorer filter lens's facets (docs/specs/013-workspace/explorer-filters.md "Telemetry"): the values of the shared
// Explorer's LENS_TELEMETRY_TYPES, whose keys are lower case.
const LENS_FACETS = tokensAfter(
  read('../../packages/explorer/src/lens/dimensions.ts'),
  'export const LENS_TELEMETRY_TYPES',
  '}',
).filter((token) => /^[A-Z]/.test(token));

// The api's email templates: `export type EmailKind = 'Welcome' | ...;`.
const EMAIL_KINDS = tokensAfter(read('api/src/email/templates.ts'), 'export type EmailKind', ';');

// The verbs the CLI counts (packages/agent-verbs), as their `Cli·Used` types.
const CLI_VERBS = countedVerbs().map((v) => pascalToken(v.id));

// Each tool the MCP server registers, from its verb (packages/agent-verbs mcp-tools.ts), as pascalToken(name).
const MCP_TOOLS = MCP_TOOL_VERBS.map((v) => pascalToken(v.mcp.tool));

// The Appearance settings' labels (@liveworkspace/ui appearance-cycle.ts), the
// editor's `UI·Toggled` type on an explicit pick.
const APPEARANCE_LABELS = tokensAfter(
  read('../../packages/ui/src/appearance/appearance-cycle.ts'),
  'export const APPEARANCE_LABEL',
  '};',
);

// The Trash a restored project sat in: useProjectTrashed's `from`, Personal or Team.
const TRASH_TYPES = tokensAfter(
  read('editor/app/project/[id]/useProjectTrashed.ts'),
  'const [from, setFrom] = useState<',
  '>',
);

// The Plan tour's steps, as planTourStepTelemetryType makes them (apps/editor plan-tour-steps.ts,
// docs/specs/026-plan/plan-tour.md), both tracks; the two outros share one id. The welcome card sends no step view.
const PLAN_TOUR_STEP_SOURCE: string[] = [
  ...new Set(
    [...read('editor/components/tour/plan-tour-steps.ts').matchAll(/^ {4}id: '([a-z-]+)',/gm)].map(
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

// The Forms tour's steps, as formTourStepTelemetryType makes them (apps/editor form-tour-steps.ts,
// docs/specs/030-forms/forms.md "The Forms tour"). Its steps are top-level consts, so their ids sit two spaces in.
// The welcome card sends no step view.
const FORM_TOUR_STEP_SOURCE: string[] = [
  ...read('editor/components/tour/form-tour-steps.ts').matchAll(/^ {2}id: '([a-z-]+)',/gm),
]
  .map((m) => m[1]!)
  .filter((id) => id !== 'welcome')
  .map(
    (id) =>
      `FormTourStep${id
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
const THEMES = ['Default', 'Plum'];
const THEME_WHY = "themeTelemetryLabel(themeId): a built-in theme's label (Default for none)";
const TEMPLATES = ['Flowchart', 'Mindmap', 'Kanban'];
const TEMPLATE_WHY = "titleCaseType(kind): a template's kind";
const ELEMENT_KINDS = ['Square', 'Circle', 'Sticky', 'Icon', 'TechIcon', 'Banner', 'Video'];
const ELEMENT_WHY = 'an element kind, as the palette catalogue spells it';
const API_ERRORS = [
  'Http403.LoadTab.Forbidden',
  'Http500.SaveTab',
  'Network.Put.Projects.Tabs',
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
  // The Explorer on liveworkspace.app, in this app's name: its closed token lists (../platform-emitters.ts).
  ...platformComputedEmitters(isValidTelemetryEvent),
  // The api worker.
  'apps/api/src/email/client.ts Email·Sent': { values: EMAIL_KINDS },
  // Someone's first time in through a link, by its level (@liveworkspace/index-app JOINED_TELEMETRY_TYPE, the
  // same table as the api schema's).
  'apps/api/src/routes/internal-items.ts Project·Joined': {
    values: Object.values(LEVEL_TELEMETRY_TYPE),
  },
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
    values: ['Internal.Put.Projects.Tabs', 'Internal.Get.Projects'],
    open: 'Internal.<Method>.<Route>, the route the worker was serving',
  },

  // The CLI (apps/cli).
  'apps/cli/src/telemetry.ts Cli·Used': { values: CLI_VERBS },
  'apps/cli/src/telemetry.ts Error·Api': {
    values: ['Http503.TabView', 'Internal.ProjectLs'],
    open: 'a status or Internal, plus the command that failed',
  },

  // The MCP worker.
  'apps/mcp/src/tool-annotations.ts Mcp·Used': { values: MCP_TOOLS },
  'apps/mcp/src/api.ts Error·Api': {
    values: ['Http503.CreateProject', 'Internal.ReadProject'],
    open: 'a status or Internal, plus the tool that failed',
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
    values: ['Uncaught.Project.TypeError', 'UnhandledRejection.Explorer.Error'],
    open: 'a kind, the page it happened on, and the error name',
  },
  'packages/ui/src/PageViewTracker.tsx Page·View': {
    values: ['/', '/project', '/explorer/home', '/help/canvas/links', '/telemetry'],
    open: 'the page path, ids and query strings stripped',
  },

  // The editor.
  'apps/editor/app/project/[id]/useElementCreation.ts Element·Added': {
    values: ELEMENT_KINDS,
    open: ELEMENT_WHY,
  },
  'apps/editor/app/project/[id]/useTemplateFlow.ts Template·Used': {
    values: TEMPLATES,
    open: TEMPLATE_WHY,
  },
  'apps/editor/app/project/[id]/useProjectTrashed.ts Trash·Restored': { values: TRASH_TYPES },
  // Plan mode (docs/specs/026-plan/plan-mode.md "Telemetry"): an item type, or a set-up part.
  'apps/editor/hooks/plan/usePlanSlice.ts Plan·Added': {
    values: PLAN_ITEM_TYPES,
    open: PLAN_TYPE_WHY,
  },
  'apps/editor/hooks/plan/usePlanSlice.ts Plan·Deleted': {
    values: PLAN_ITEM_TYPES,
    open: PLAN_TYPE_WHY,
  },
  'apps/editor/components/plan/track-board-setup.ts Plan·Changed': { values: PLAN_SETUP_PARTS },
  // A Dashboard tab's layout change names its kind (usePlanTabActions.ts DashboardChange).
  'apps/editor/hooks/plan/usePlanTabActions.ts Plan·Changed': {
    values: [
      'DashboardRow',
      'DashboardSlot',
      'DashboardContent',
      'DashboardLook',
      'DashboardCardStyle',
    ],
  },
  // A board or a view maximised from its header, or restored (maximised-plan.ts MaximisedKind).
  'apps/editor/hooks/plan/maximised-plan.ts Plan·Toggled': {
    values: [
      'BoardMaximised',
      'ViewMaximised',
      'SheetMaximised',
      'BoardRestored',
      'ViewRestored',
      'SheetRestored',
    ],
  },
  // A form started names its starter, a question added its type (docs/specs/030-forms/forms.md "Telemetry").
  'apps/editor/hooks/forms/useFormActions.ts Form·Created': {
    values: FORM_STARTERS.map((s) => s.telemetry),
  },
  'apps/editor/components/forms/builder/FormAddBar.tsx Form·Added': {
    values: Object.values(QUESTION_TYPE_TELEMETRY),
  },
  // Not Taking Responses pressed names its reason (apps/editor/components/forms/form-not-taking.ts FORM_NOT_TAKING).
  'apps/editor/components/forms/FormNotTakingWarning.tsx Form·Opened': {
    values: [
      'NotTakingSuspended',
      'NotTakingPaused',
      'NotTakingSwitchedOff',
      'NotTakingClosesAt',
      'NotTakingLimit',
      'NotTakingFull',
    ],
  },
  // A Sheet change names its kind (api-schema SHEET_CHANGE_KINDS); a formula's first use of a function, its name.
  'apps/editor/components/sheets/sheet-controller.tsx Sheet·Changed': {
    values: [...SHEET_CHANGE_KINDS],
  },
  // A Sheet set up from Setup Sheet names how it started (SheetSetup.tsx TELEMETRY).
  'apps/editor/components/sheets/SheetSetup.tsx Sheet·Created': {
    values: [
      'Blank',
      'Budget',
      'Tracker',
      'Timesheet',
      'Contacts',
      'Invoice',
      'ExpenseReport',
      'SalesPipeline',
      'Inventory',
      'ThreatRegister',
      'DriverModel',
      'ValueStream',
      'GuestList',
      'GradeBook',
      'HabitTracker',
      'LoanCalculator',
      'Cards',
      'Csv',
    ],
  },
  'apps/editor/components/sheets/useSheetActions.ts Sheet·Used': {
    values: ['SUM', 'AVERAGE', 'IF', 'VLOOKUP', 'CARDCOUNT'],
    open: "a function's name, from the Sheet's closed function list (packages/sheets FUNCTION_NAMES)",
  },
  // An item opened: `Item` from a board or a list, or how the item panel moved to it (item-trail.ts ItemOpenVia).
  'apps/editor/hooks/plan/usePlanSlice.ts Plan·Opened': {
    values: ['Item', 'Parent', 'ChildCard', 'Breadcrumb'],
  },
  // The shared Explorer's Timeline, through its onTimeline prop (@liveworkspace/explorer TimelinePane.tsx): each a
  // fixed token from the package.
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
  'apps/editor/app/new/page.tsx Theme·Changed': { values: THEMES, open: THEME_WHY },
  'apps/editor/app/new/page.tsx Template·Used': { values: TEMPLATES, open: TEMPLATE_WHY },
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
  'apps/editor/components/panels/SearchPanel.tsx UI·Opened': { values: SLUGS, open: SLUG_WHY },
  'apps/editor/components/panels/SearchPanel.tsx Search·Selected': {
    values: ['Project', 'Shared', 'Folder', 'Team', 'Tab', 'Element', 'Palette', 'Command'],
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
  'apps/editor/app/project/[id]/useIdentityBootstrap.ts Error·Warning': {
    values: [
      'ProjectLoad.TimedOut.Identity',
      'ProjectLoad.TimedOut.Participant',
      'ProjectLoad.TimedOut.Project',
      'ProjectLoad.TimedOut.Share',
      'ProjectLoad.TimedOut.FirstTab',
      'ProjectLoad.AutoReload',
      'ProjectLoad.Late',
    ],
  },
  'apps/editor/app/project/[id]/useIdentityBootstrap.ts Error·Client': {
    values: ['ProjectLoad.TypeError', 'ProjectLoad.Error'],
    open: 'ProjectLoad.<ErrorName>',
  },
  'apps/editor/components/providers/ErrorTelemetryBoot.tsx Error·Warning': {
    values: ['OfflineStore.Unavailable', 'SessionToken.TimedOut'],
  },
  'apps/editor/components/providers/ErrorTelemetryBoot.tsx Error·Api': {
    values: API_ERRORS,
    open: API_ERROR_WHY,
  },
  'apps/editor/components/tour/PlanTourHost.tsx UI·View': { values: PLAN_TOUR_STEP_SOURCE },
  'apps/editor/components/tour/FormTourHost.tsx UI·View': { values: FORM_TOUR_STEP_SOURCE },
  'apps/editor/hooks/canvas/useDebouncedCanvasTelemetry.ts Canvas·Changed': {
    values: Object.keys(CANVAS_CONTROLS),
  },
  'apps/editor/hooks/canvas/useTabCanvas.ts Tab·Aligned': {
    values: ['Smart', 'FlowchartDown', 'FlowchartRight', 'Tree', 'Mindmap'],
  },
  'apps/editor/hooks/canvas/useTabCanvas.ts Canvas·Changed': {
    values: ['Blank', 'Grid', 'Dots', 'Graph'],
    open: 'titleCaseType(pattern): a background pattern',
  },
  'apps/editor/hooks/canvas/useTabTheme.ts Theme·Changed': { values: THEMES, open: THEME_WHY },
  // The Sequence dialog's writes (apps/editor/hooks/canvas/useSequenceSetters.ts): which part of it changed.
  'apps/editor/hooks/canvas/useSequenceSetters.ts Element·Changed': {
    values: ['SequenceParticipants', 'SequenceMessages', 'SequenceText'],
  },
  // The element menu's whole-tab writes (apps/editor/lib/element-style-ops.ts `commitTab`).
  'apps/editor/components/palette/EditorContextMenuHost.tsx Element·Changed': {
    values: ['RenumberSteps'],
  },
  'apps/editor/hooks/canvas/useTextStyleSetters.ts Element·Toggled': {
    values: ['Bold', 'Italic', 'Underline', 'Strikethrough'],
  },
  'apps/editor/hooks/canvas/useWebComponentSetters.ts Element·Changed': {
    values: ['Banner', 'Callout', 'StatRow'],
    open: 'elementTelemetryType of the web component a row was added to',
  },
  'apps/editor/hooks/ui/useAppearance.ts UI·Toggled': { values: APPEARANCE_LABELS },
  // The Share dialog's reports, through its onTelemetry prop (@liveworkspace/explorer ShareDialog.tsx): each a fixed
  // token from the package.
  'apps/editor/lib/explorer-share-host.ts UI·Copied': {
    values: ['ShareLink', 'EmbedCode', 'LiveImage'],
  },
  'apps/editor/lib/explorer-share-host.ts Project·Removed': { values: ['ShareLink'] },
  'apps/editor/lib/explorer-share-host.ts Project·Shared': {
    values: EXPLORER_TELEMETRY_EVENTS['Project·Shared'],
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
