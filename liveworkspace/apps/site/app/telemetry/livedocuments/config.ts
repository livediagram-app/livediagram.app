// livedocuments.app's telemetry dashboard, as data (liveworkspace/docs/telemetry.md "The dashboard"): every
// view is shared (../_shared); this is what makes it this app's. Its events and how they read, its
// charts on each tab, and its name, noun and accent.

import {
  ctaSurfaceOf,
  ctaSurfaceOfPath,
  CTA_SOURCES,
  CTA_SURFACES,
  isCtaSource,
  PALETTE_TELEMETRY_TYPES,
  pageViewApp,
  parseTimingType,
  type PageViewApp,
  type TelemetryCategory,
} from '@livedocuments/api-schema';
import { noun, type TelemetryAppConfig } from '../_shared/app';
import { createCtaFunnel } from '../_shared/cta-funnel';
import { createEventExplanation } from '../_shared/event-explanation';
import { cliCommandSentence } from './cli-commands';
import { API_OPERATIONS, BY_ACTION, EXACT } from './event-explanations';
import {
  ACCOUNT_ACTIVITY,
  AGENT_CHANGESETS,
  AGENT_VIEWED,
  ALL_VISITORS,
  API_TOKEN_ACTIVITY,
  ARTICLE_VIEWS,
  ASSIGNED_ACTIONS,
  CALLS_TO_ACTION,
  CANVAS_MODES,
  CLIENT_EXCEPTIONS,
  CLI_COMMANDS_STACK,
  DISCUSSION,
  DOCUMENTS_CREATED,
  DOCUMENT_ACTIONS,
  DRY_HELP_SEARCHES,
  EDITOR_CHROME,
  EDITOR_SEARCH,
  EDITOR_TIMING_CHARTS,
  ELEMENTS_ADDED,
  ELEMENT_EDITING,
  ELEMENT_TOURS,
  EMAILS_SENT,
  EXCEPTIONS,
  EXPORT_AND_IMPORT,
  FAILED_REQUESTS,
  HELP_CENTRE,
  HELP_SEARCHES,
  JOINING,
  LAYERS_FEATURE,
  LIVE_TOGETHER,
  LOAD_RECOVERY,
  LOOK_AND_FEEL,
  MARKED_HELPFUL,
  MARKED_NOT_HELPFUL,
  MCP_TOOL_CALLS,
  MULTIPLAYER_SESSIONS,
  NEW_VERSION_PROMPT,
  NEW_VISITORS,
  NOTES,
  OFFLINE_MODE,
  ONBOARDING_TOURS,
  ORGANISATION,
  PAGES_TOUR,
  PAGE_VIEWS_BY_APP,
  PAGE_WORK,
  PALETTE_USE,
  PANELS_OPENED,
  POWER_USER_OFFER,
  PRESENTATIONS,
  REALTIME_RESYNCS,
  RETURNING_VISITORS,
  SERVER_CRASHES,
  SETTINGS_CHANGED,
  SETTINGS_STACKS,
  SHARE_LINKS_MADE,
  SHARING_AND_EMBEDS,
  SHOW_ME_TOURS,
  SIDE_BY_SIDE,
  SIGN_IN_PROMPTS,
  SIGN_UPS,
  STALE_CHUNK_RELOADS,
  TABLES,
  TAB_ACTIONS,
  TEAM_ACTIVITY,
  TIMELINE_AND_ACTIVITY,
  TRASH,
  UNDO_AND_REDO,
  WEB_VITAL_CHARTS,
  WELCOME_DIALOG_CLOSED,
} from './metric-catalogue';
import { isNonThemePick, PALETTE_TYPE_ALIASES, SELECTION_MODES } from './palette-types';
import { isRetiredEvent } from './retired-events';

const NOUN = noun('document');

// Per-category colour for every chart (../_shared/event-vocab.ts). Keyed by the full
// TelemetryCategory union, so a new category fails the typecheck until it gets its own colour.
const CATEGORY_COLORS: Record<TelemetryCategory, string> = {
  Document: '#0ea5e9',
  Element: '#10b981',
  Tab: '#f59e0b',
  Theme: '#8b5cf6',
  Canvas: '#ec4899',
  Template: '#06b6d4',
  Comment: '#84cc16',
  Note: '#f97316',
  Action: '#65a30d',
  Search: '#6366f1',
  UI: '#0891b2',
  Folder: '#a855f7',
  Layer: '#7c3aed',
  Session: '#64748b',
  Facilitator: '#a855f7',
  Team: '#2563eb',
  Participant: '#dc2626',
  Help: '#14b8a6',
  // Deep pink: apart from Canvas's lighter pink and every blue it sits near.
  Page: '#9d174d',
  // Deep green, the funnel's colour: apart from Element's emerald and the
  // lime of Comment and Action.
  Cta: '#15803d',
  // Distinct from Document's sky (#0ea5e9) and Session's slate: the
  // Timeline sits next to both in the stacked bar.
  Timeline: '#0369a1',
  // Indigo-violet: the landing view, apart from the Timeline's deep sky and Activity's amber.
  Home: '#4f46e5',
  // Amber, so the inbox reads apart from the Timeline's deep sky beside it.
  Activity: '#d97706',
  Token: '#d946ef',
  // Warm stone: a quiet backstop, apart from Document's sky and Error's red.
  Trash: '#78716c',
  Mcp: '#f43f5e',
  // Terminal ink: the command line, darker than Trash's stone grey.
  Cli: '#1e293b',
  // Burnt orange: the agents' changesets, apart from MCP's rose and Activity's amber.
  Agent: '#c2410c',
  Email: '#0d9488',
  Error: '#dc2626',
  // Deep cyan: the Explorer's filters, apart from UI's lighter cyan and Search's indigo.
  Explorer: '#155e75',
  // Deep teal-green, a stopwatch: apart from Email's teal and Cta's green.
  Timing: '#047857',
};

const PAGE_VIEW_APPS: PageViewApp[] = ['Marketing', 'Live', 'Help', 'Dashboard'];

const FUNNEL = createCtaFunnel({
  surfaces: CTA_SURFACES,
  sources: CTA_SOURCES,
  isSource: isCtaSource,
  surfaceOf: ctaSurfaceOf,
  surfaceOfPath: ctaSurfaceOfPath,
});

export const LIVEDOCUMENTS: TelemetryAppConfig = {
  id: 'livedocuments.app',
  name: 'livedocuments',
  // Its brand-500 (telemetry.css's [data-app='livedocuments.app'] scale).
  accent: '#f59e0b',
  noun: NOUN,
  categoryColors: CATEGORY_COLORS,
  explain: createEventExplanation({
    name: 'livedocuments',
    noun: NOUN,
    exact: EXACT,
    byAction: BY_ACTION,
    apiOperations: API_OPERATIONS,
    cliCommandSentence,
    funnel: FUNNEL,
    parseTimingType,
  }),
  isRetired: isRetiredEvent,
  funnel: FUNNEL,
  pageViews: { apps: PAGE_VIEW_APPS, appOf: pageViewApp },
  dashboard: [
    {
      title: 'At a glance',
      metrics: [
        NEW_VISITORS,
        RETURNING_VISITORS,
        SIGN_UPS,
        DOCUMENTS_CREATED,
        MULTIPLAYER_SESSIONS,
        FAILED_REQUESTS,
      ],
    },
    {
      title: 'Visitors',
      metrics: [
        ALL_VISITORS,
        ACCOUNT_ACTIVITY,
        PAGE_VIEWS_BY_APP,
        SIGN_IN_PROMPTS,
        ONBOARDING_TOURS,
      ],
    },
    {
      title: 'Content',
      metrics: [DOCUMENT_ACTIONS, TAB_ACTIONS, ELEMENTS_ADDED, ELEMENT_EDITING],
    },
    {
      title: 'Features',
      metrics: [PAGE_WORK, PALETTE_USE, CANVAS_MODES, LOOK_AND_FEEL, PANELS_OPENED, OFFLINE_MODE],
    },
    // Live Together is the only stack that counts two people on one canvas at
    // the same moment; the rest of Collaboration counts the ways in and keeping
    // up, so read them against it.
    {
      title: 'Collaboration',
      metrics: [
        LIVE_TOGETHER,
        JOINING,
        SHARE_LINKS_MADE,
        SHARING_AND_EMBEDS,
        TIMELINE_AND_ACTIVITY,
        PRESENTATIONS,
      ],
    },
    {
      title: 'Connections',
      metrics: [MCP_TOOL_CALLS, CLI_COMMANDS_STACK, AGENT_VIEWED],
    },
    // Emails Sent is written server-side by the api worker: nothing about a send
    // reaches a browser, so this is the only place it can be counted. The
    // onboarding series exists to bring people back, so read it against All
    // Visitors. Failures land on Exceptions as Error·Api·Http*.SendEmail.
    {
      title: 'Health & support',
      metrics: [EXCEPTIONS, HELP_CENTRE, EMAILS_SENT],
    },
  ],
  editing: {
    groups: [
      {
        title: 'Editing tools',
        metrics: [NOTES, ASSIGNED_ACTIONS, ORGANISATION],
      },
      {
        title: 'More editing',
        metrics: [
          UNDO_AND_REDO,
          EXPORT_AND_IMPORT,
          TABLES,
          LAYERS_FEATURE,
          SIDE_BY_SIDE,
          EDITOR_SEARCH,
          EDITOR_CHROME,
          TRASH,
        ],
      },
    ],
    exportFormats: 'Which formats diagrams leave in: PNG, SVG, PDF, JSON, Markdown',
    aiOptIn: false,
  },
  palette: {
    tabs: PALETTE_TELEMETRY_TYPES,
    aliases: PALETTE_TYPE_ALIASES,
    subtitles: {
      shapes: 'Boxes, circles, stars, speech bubbles and other primitives',
      devices: 'Device frames: browser, phone, laptop and friends',
    },
  },
  modes: {
    selection: SELECTION_MODES,
    selectionSubtitle: 'Laser, spotlight, eraser, format painter, isometric',
    option: /^(Laser|Spotlight|Format)/,
    optionsSubtitle:
      'Settings inside a mode: eraser size and target, laser colour and trail, spotlight shape, format painter copies',
  },
  settings: [
    { title: 'All categories', metrics: [SETTINGS_CHANGED] },
    { title: 'By category', metrics: [...SETTINGS_STACKS] },
  ],
  isNonThemePick,
  teamwork: {
    key: 'teamwork',
    title: 'Discussion & Teams',
    intro: 'Comments and teams, beside the presenting on the Dashboard',
    groups: [
      {
        title: 'Discussion and teams',
        metrics: [DISCUSSION, TEAM_ACTIVITY],
      },
    ],
  },
  connections: {
    intro: 'API tokens and agent changes, beside the MCP and CLI on the Dashboard',
    groups: [{ title: 'Connections', metrics: [API_TOKEN_ACTIVITY, AGENT_CHANGESETS] }],
  },
  pages: [{ title: 'Calls to action', metrics: [CALLS_TO_ACTION] }],
  help: {
    groups: [
      {
        title: 'Help engagement',
        metrics: [
          ARTICLE_VIEWS,
          MARKED_HELPFUL,
          MARKED_NOT_HELPFUL,
          HELP_SEARCHES,
          DRY_HELP_SEARCHES,
        ],
      },
    ],
  },
  tours: [
    {
      title: 'Tours',
      metrics: [PAGES_TOUR, ELEMENT_TOURS, SHOW_ME_TOURS],
    },
    { title: 'Prompts', metrics: [WELCOME_DIALOG_CLOSED, POWER_USER_OFFER, NEW_VERSION_PROMPT] },
  ],
  exceptions: {
    groups: [
      {
        title: 'Error volume',
        metrics: [
          FAILED_REQUESTS,
          SERVER_CRASHES,
          CLIENT_EXCEPTIONS,
          REALTIME_RESYNCS,
          STALE_CHUNK_RELOADS,
        ],
      },
    ],
    recovery: [{ title: 'Recovery', metrics: [LOAD_RECOVERY] }],
    warningExample: 'a document that was slow to open',
  },
  timings: { editor: EDITOR_TIMING_CHARTS, vitals: WEB_VITAL_CHARTS },
};
