// The comparison every page shows (subscription.md "What people see"): one row per limit, grouped, with the app it
// belongs to, a sentence that explains it, and how its number reads. The upgrade dialog, the pricing page and
// Settings all draw these rows, so a limit is described once.

import { isPerMemberLimit, TIER_LIMITS, type LimitKey, type Tier } from './tiers';
import { formatBytes, formatDays, NUMBER } from './format';

// Kept here too: the comparison's callers read every formatter from the rows.
export { formatBytes, formatDays } from './format';
import type { UsageKey } from './wire';

export const LIMIT_GROUPS = [
  'Automation',
  'Publishing',
  'AI',
  'Storage and History',
  'Recording and Calls',
  'Knowledgebases',
] as const;
export type LimitGroup = (typeof LIMIT_GROUPS)[number];

/** Every app, in the order their logos are drawn. */
export const ROW_APPS = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
  'liveknowledge',
] as const;
/** An app a row applies to: each one's logo is drawn beside the row (owner, 2026-11-22: never liveworkspace's). */
export type RowApp = (typeof ROW_APPS)[number];

// Which apps a shared limit applies to, as each app uses it (verified in each app's code, 2026-11-22).
const EVERY_APP: readonly RowApp[] = ROW_APPS;
// Walkthroughs: every app but livehuddle, which records none.
const WALKTHROUGH_APPS: readonly RowApp[] = ROW_APPS.filter((app) => app !== 'livehuddle');
// AI credits: livediagram's photo reads, liveplanner's drafts and AI steps, liveknowledge's Ask.
const AI_CREDIT_APPS: readonly RowApp[] = ['livediagram', 'liveplanner', 'liveknowledge'];

type RowUnit = 'count' | 'bytes' | 'days' | 'duration' | 'free';

export type LimitRow = {
  key: LimitKey;
  label: string;
  group: LimitGroup;
  /** The apps it applies to, in ROW_APPS order. */
  apps: readonly RowApp[];
  /** One sentence for someone who does not know the feature. */
  info: string;
  unit: RowUnit;
  /** "a day" or "a month", after the number. */
  per?: 'a day' | 'a month';
  /** The usage shown beside it, when there is any to show. */
  usage?: UsageKey;
  /** Left out of the tier comparison: the same on every tier, so nothing to compare (Largest Image, owner
   *  2026-11-23). Its row still words a refusal at it. */
  compared?: false;
};

export const LIMIT_ROWS: readonly LimitRow[] = [
  {
    key: 'automationRunsPerMonth',
    label: 'Automation Runs',
    group: 'Automation',
    apps: EVERY_APP,
    info: 'Runs are counted across all your items in every app: each run that does something counts as one, and so does each message it sends to Slack, Teams or a webhook. A rule whose conditions do not match costs nothing.',
    unit: 'count',
    per: 'a month',
    usage: 'automationRuns',
  },
  {
    key: 'automationRules',
    label: 'Automation Rules',
    group: 'Automation',
    apps: EVERY_APP,
    info: 'How many automation rules you can hold at once, across all your plans, diagrams, documents, designs and knowledgebases.',
    unit: 'count',
    usage: 'rules',
  },
  {
    key: 'emailToBoardPerMonth',
    label: 'Email to Board',
    group: 'Automation',
    apps: ['liveplanner'],
    info: "Emails sent to a board's address that become cards, across all your plans.",
    unit: 'count',
    per: 'a month',
    usage: 'emailToBoard',
  },
  {
    key: 'formResponsesPerMonth',
    label: 'Form Responses',
    group: 'Publishing',
    apps: ['liveplanner'],
    info: 'How many responses your forms take each month, across all your plans.',
    unit: 'count',
    per: 'a month',
    usage: 'formResponses',
  },
  {
    key: 'publicRoadmaps',
    label: 'Public Roadmaps',
    group: 'Publishing',
    apps: ['liveplanner'],
    info: 'Boards published as a public page that anyone can view and vote on.',
    unit: 'count',
    usage: 'publicRoadmaps',
  },
  {
    key: 'publicKnowledgebases',
    label: 'Public Knowledgebases',
    group: 'Publishing',
    apps: ['liveknowledge'],
    info: 'Knowledgebases published to the web as a public site that anyone can read and search.',
    unit: 'count',
    usage: 'publicKnowledgebases',
  },
  {
    key: 'aiCreditsPerMonth',
    label: 'AI Credits',
    group: 'AI',
    apps: AI_CREDIT_APPS,
    info: 'One credit is one AI request, such as drafting a rule or a plan from a description.',
    unit: 'count',
    per: 'a month',
    usage: 'aiCredits',
  },
  {
    key: 'ownAiKey',
    label: 'Bring Your Own AI',
    group: 'AI',
    apps: ['liveknowledge'],
    info: "Use your own Claude or OpenAI key for AI, in your own work or your team's. It is free on every plan and spends no AI credits.",
    unit: 'free',
  },
  {
    key: 'imageStorageBytes',
    label: 'Image Storage',
    group: 'Storage and History',
    apps: EVERY_APP,
    info: 'The total size of the images you have uploaded, across every app.',
    unit: 'bytes',
    usage: 'imageStorageBytes',
  },
  {
    key: 'imageMaxBytes',
    label: 'Largest Image',
    group: 'Storage and History',
    apps: EVERY_APP,
    info: 'The largest single image you can upload.',
    unit: 'bytes',
    compared: false,
  },
  {
    key: 'historyDays',
    label: 'Version History and Snapshots',
    group: 'Storage and History',
    apps: EVERY_APP,
    info: 'How long earlier versions and snapshots are kept so you can go back to them.',
    unit: 'days',
  },
  {
    key: 'walkthroughMaxMs',
    label: 'Walkthrough Length',
    group: 'Recording and Calls',
    apps: WALKTHROUGH_APPS,
    info: 'The longest one recorded walkthrough can run.',
    unit: 'duration',
  },
  {
    key: 'walkthroughsStored',
    label: 'Walkthroughs Stored',
    group: 'Recording and Calls',
    apps: WALKTHROUGH_APPS,
    info: 'How many recorded walkthroughs you can keep at once.',
    unit: 'count',
    usage: 'walkthroughsStored',
  },
  {
    key: 'callMinutesPerMonth',
    label: 'Call Minutes',
    group: 'Recording and Calls',
    apps: ['livehuddle'],
    info: 'Counted only while two or more people are in a livehuddle call: each of them, for each minute. Being in a Space alone counts nothing.',
    unit: 'count',
    per: 'a month',
    usage: 'callMinutes',
  },
  {
    key: 'knowledgebasePages',
    label: 'Knowledgebase Pages',
    group: 'Knowledgebases',
    apps: ['liveknowledge'],
    info: 'How many pages you can hold at once, across all your Knowledgebases.',
    unit: 'count',
    usage: 'pages',
  },
  {
    key: 'aiKnowledgeHistoryDays',
    label: 'AI Knowledge History',
    group: 'Knowledgebases',
    apps: ['liveknowledge'],
    info: 'How far back you can see what AI agents read and asked.',
    unit: 'days',
  },
];

export function limitRow(key: LimitKey): LimitRow {
  const row = LIMIT_ROWS.find((candidate) => candidate.key === key);
  if (!row) throw new Error(`No comparison row for ${key}`);
  return row;
}

/** A plain number of a row's unit, without its period: 1,500, 500 MB, 30 minutes. */
export function formatAmount(row: LimitRow, value: number): string {
  if (row.unit === 'bytes') return formatBytes(value);
  if (row.unit === 'days') return formatDays(value);
  if (row.unit === 'duration') return `${NUMBER.format(Math.round(value / 60_000))} minutes`;
  return NUMBER.format(value);
}

/** One cell of the comparison: what a tier allows for a row, as words. */
export function formatTierLimit(row: LimitRow, tier: Tier): string {
  const value = TIER_LIMITS[tier][row.key];
  // A yes-or-no limit (Bring Your Own AI) is its only boolean.
  if (row.unit === 'free' || typeof value === 'boolean') return value ? 'Free' : 'Not included';
  if (value === null) return 'Unlimited';
  if (value === 0) return 'Not included';
  const amount = formatAmount(row, value);
  if (tier === 'team' && isPerMemberLimit(row.key)) return `${amount} a member`;
  return row.per ? `${amount} ${row.per}` : amount;
}

/** "42 of 100", or just the count against an unlimited limit. */
export function formatUsage(row: LimitRow, used: number, limit: number | null): string {
  const amount = formatAmount(row, used);
  return limit === null ? amount : `${amount} of ${formatAmount(row, limit)}`;
}

/** The apps under a row's name: "Every app", "Every app but livehuddle", "liveknowledge", "livediagram,
 *  liveplanner and liveknowledge". */
export function rowAppsName(apps: readonly RowApp[]): string {
  if (apps.length === ROW_APPS.length) return 'Every app';
  if (apps.length === ROW_APPS.length - 1) {
    return `Every app but ${ROW_APPS.find((app) => !apps.includes(app))}`;
  }
  if (apps.length === 1) return apps[0]!;
  return `${apps.slice(0, -1).join(', ')} and ${apps.at(-1)}`;
}
