// What the api says of a knowledgebase's tier (docs/specs/030-knowledgebase/tiers.md). All of it is absent with Pro off.

/** The owner whose tier a knowledgebase runs on: `p:<account id>` or `t:<team id>`, as the subscription service
 *  names one. */
export type KnowledgeTierOwner = string;

/** The document read's `knowledgeTier`: the figures the knowledgebase's tier sets, the same for everyone. `pagesMax`
 *  is the most one knowledgebase holds (a fixed bound), `pagesLimit` the owner's Knowledgebase Pages over all of
 *  theirs (absent for a guest's and nobody's). `owner` is who an upgrade is for (absent for a guest's and for nobody's
 *  knowledgebase); `guest`: Free's limits, no offer. */
export type KnowledgeTierInfo = {
  pagesMax: number;
  pagesLimit?: number;
  historyDays: number;
  owner?: KnowledgeTierOwner;
  guest?: true;
};

/** A refusal a tier limit caused, beside its `error`: which limit, what is used, and the most the tier allows. */
export type KnowledgeTierRefusal = {
  limit: 'knowledgebasePages' | 'aiCreditsPerMonth' | 'publicKnowledgebases';
  used: number;
  max: number;
  guest?: true;
};

/** The owner's AI credits this month, after a built-in call spent one: `X-AI-Credits: <used>/<limit>` on Ask's
 *  stream, `credits` on the setup answer. */
export type KnowledgeAiCredits = { used: number; limit: number };

export const AI_CREDITS_HEADER = 'X-AI-Credits';

/** `X-AI-Credits` read, or null when absent or not two whole numbers. */
export function readAiCreditsHeader(value: string | null): KnowledgeAiCredits | null {
  const match = /^(\d{1,9})\/(\d{1,9})$/.exec(value ?? '');
  return match ? { used: Number(match[1]), limit: Number(match[2]) } : null;
}

/** The periods Most Read offers with Pro on, in days (tiers.md "AI Knowledge History"). */
export const MOST_READ_PERIODS = [30, 90, 365] as const;
export type MostReadPeriod = (typeof MOST_READ_PERIODS)[number];

/** The period a request asks for (`?days=`), clamped to what the tier keeps: 30 when absent or not one of them. */
export function mostReadPeriodOf(asked: string | null, keptDays: number): number {
  const wanted = MOST_READ_PERIODS.find((days) => String(days) === asked) ?? MOST_READ_PERIODS[0];
  return Math.min(wanted, keptDays);
}
