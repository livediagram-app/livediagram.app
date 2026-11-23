// The three tiers and what each allows (liveworkspace/docs/specs/019-subscription/subscription.md "Tiers and
// limits"). Every Worker and page reads its numbers from here, so a limit is written once.
import { IMAGE_MAX_BYTES } from './image-sizes';

export const TIERS = ['free', 'pro', 'team'] as const;
export type Tier = (typeof TIERS)[number];

export function isTier(value: unknown): value is Tier {
  return TIERS.some((tier) => tier === value);
}

export const TIER_NAMES: Record<Tier, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Pro for Teams',
};

const MB = 1000 * 1000;
const GB = 1000 * MB;
const MINUTE_MS = 60 * 1000;

/** A tier's limits as numbers. `null` is unlimited. */
export type Limits = {
  /** Automation runs that did something (a No Match costs nothing), and each message a run sends through a
   *  connection, per owner, per month, over every item in every app (owner, 2026-11-22). */
  automationRunsPerMonth: number;
  /** The automation rules an owner holds at once, over every item in every app (owner, 2026-11-22). */
  automationRules: number;
  /** Emails turned into cards, per owner, per month, over every plan (owner, 2026-11-22). */
  emailToBoardPerMonth: number;
  /** Responses an owner's forms take, per month, over every form (owner, 2026-11-22). */
  formResponsesPerMonth: number;
  publicRoadmaps: number | null;
  /** Knowledgebases published to the web at once, per owner (owner, 2026-11-22). */
  publicKnowledgebases: number | null;
  /** One credit is one AI operation, per owner, per month. */
  aiCreditsPerMonth: number;
  imageStorageBytes: number;
  imageMaxBytes: number;
  /** How long version history and snapshots are kept. */
  historyDays: number | null;
  walkthroughMaxMs: number;
  walkthroughsStored: number | null;
  /** One person in a call for one minute, per owner, per month. */
  callMinutesPerMonth: number;
  /** The pages an owner holds at once, over every knowledgebase (owner, 2026-11-22). */
  knowledgebasePages: number;
  aiKnowledgeHistoryDays: number;
  /** Whether the owner (a person, or a team) may bring their own AI (a Claude or OpenAI key), which spends no AI credits. Free on every tier
   *  (owner, 2026-11-22). */
  ownAiKey: boolean;
};

export type LimitKey = keyof Limits;

/** Pro for Teams never bills, or pools for, fewer members than this. */
export const TEAM_SEATS_MIN = 3;
/** Nor more than this: the most people accounts lets a team have (its `MAX_MEMBERS_PER_TEAM`). */
export const TEAM_SEATS_MAX = 200;

const FREE: Limits = {
  automationRunsPerMonth: 500,
  automationRules: 25,
  emailToBoardPerMonth: 500,
  formResponsesPerMonth: 500,
  publicRoadmaps: 1,
  publicKnowledgebases: 1,
  aiCreditsPerMonth: 50,
  imageStorageBytes: 500 * MB,
  imageMaxBytes: IMAGE_MAX_BYTES,
  historyDays: 7,
  walkthroughMaxMs: 5 * MINUTE_MS,
  walkthroughsStored: 5,
  callMinutesPerMonth: 1000,
  knowledgebasePages: 500,
  aiKnowledgeHistoryDays: 30,
  ownAiKey: true,
};

const PRO: Limits = {
  automationRunsPerMonth: 10_000,
  automationRules: 500,
  emailToBoardPerMonth: 10_000,
  formResponsesPerMonth: 10_000,
  publicRoadmaps: 10,
  publicKnowledgebases: 10,
  aiCreditsPerMonth: 1000,
  imageStorageBytes: 50 * GB,
  imageMaxBytes: IMAGE_MAX_BYTES,
  historyDays: null,
  walkthroughMaxMs: 30 * MINUTE_MS,
  walkthroughsStored: null,
  callMinutesPerMonth: 5000,
  knowledgebasePages: 10_000,
  aiKnowledgeHistoryDays: 365,
  ownAiKey: true,
};

/** Pro for Teams before its per-member limits are pooled: those hold the figure for ONE member. */
const TEAM: Limits = {
  ...PRO,
  automationRunsPerMonth: 5000,
  automationRules: 250,
  emailToBoardPerMonth: 5000,
  formResponsesPerMonth: 5000,
  publicRoadmaps: null,
  publicKnowledgebases: null,
  aiCreditsPerMonth: 500,
  imageStorageBytes: 250 * GB,
  callMinutesPerMonth: 2500,
  knowledgebasePages: 5000,
};

/** Each tier's limits as the comparison shows them: a team's per-member limits are for one member. */
export const TIER_LIMITS: Record<Tier, Limits> = { free: FREE, pro: PRO, team: TEAM };

/** The limits a team's members share: the figure is per member and the team's seats multiply it. */
export const PER_MEMBER_LIMITS = [
  'automationRunsPerMonth',
  'automationRules',
  'emailToBoardPerMonth',
  'formResponsesPerMonth',
  'aiCreditsPerMonth',
  'callMinutesPerMonth',
  'knowledgebasePages',
] as const satisfies readonly LimitKey[];

export function isPerMemberLimit(key: LimitKey): boolean {
  return PER_MEMBER_LIMITS.some((pooled) => pooled === key);
}

/** The seats a team is billed and pooled for: its joined members, never fewer than the minimum. */
export function seatsFor(members: number): number {
  return Math.max(TEAM_SEATS_MIN, Math.floor(Number.isFinite(members) ? members : 0));
}

/** A tier's limits as an owner gets them: a team's pooled limits already multiplied by its seats. */
export function limitsFor(tier: Tier, seats = TEAM_SEATS_MIN): Limits {
  const limits = TIER_LIMITS[tier];
  if (tier !== 'team') return limits;
  const pooled = seatsFor(seats);
  const team: Limits = { ...limits };
  for (const key of PER_MEMBER_LIMITS) team[key] = limits[key] * pooled;
  return team;
}

/** Whether `used` has reached a limit. An unlimited limit is never reached. */
export function limitReached(used: number, limit: number | null): boolean {
  return limit !== null && used >= limit;
}

/** How much of a limit is left, never below zero. Unlimited is Infinity. */
export function limitLeft(used: number, limit: number | null): number {
  return limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - used);
}
