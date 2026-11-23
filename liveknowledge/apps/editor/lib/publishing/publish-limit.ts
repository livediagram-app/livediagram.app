// Public Knowledgebases in Publish to the Web (docs/specs/030-knowledgebase/publishing.md "Tiers", "What the dialog
// shows"; Pro on only): a refused publish's numbers, and the notice's one sentence. The numbers are the api's.
import { PUBLISH_LIMIT_REACHED, type PublishLimitBody } from '@liveknowledge/api-schema';
import { TIER_LIMITS, TIER_NAMES, type PaidTier, type Tier } from '@liveworkspace/subscription';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

/** A publish the owner's tier refused: what is used and the most it allows. `guest`: Free's, with no offer. */
export type PublishLimit = { used: number; max: number; guest: boolean };

/** The refusal `err` carries, or null when it is another one (or names no numbers). */
export function publishLimitOf(err: unknown): PublishLimit | null {
  if (!(err instanceof ApiError) || err.code !== PUBLISH_LIMIT_REACHED) return null;
  const body = err.body as Partial<PublishLimitBody> | null;
  if (typeof body?.used !== 'number' || typeof body.max !== 'number') return null;
  return { used: body.used, max: body.max, guest: body.guest === true };
}

const count = (n: number) => n.toLocaleString('en-US');

// The tier whose figure the owner meets, worked out from it (a collaborator is never told the tier itself).
const tierOf = (max: number): Tier | null =>
  (Object.keys(TIER_LIMITS) as Tier[]).find((t) => TIER_LIMITS[t].publicKnowledgebases === max) ??
  null;

/**
 * "You have 1 public Knowledgebase, the most Free publishes. Unpublish one to publish this, or publish up to 10 with
 * Pro." `offer` is the tier an upgrade would move to, for someone who may take it; null words the plain limit.
 */
export function publishLimitSentence(max: number, offer: PaidTier | null): string {
  const tier = tierOf(max);
  const noun = max === 1 ? 'Knowledgebase' : 'Knowledgebases';
  const most = tier ? `the most ${TIER_NAMES[tier]} publishes` : 'the most it publishes';
  const head = `You have ${count(max)} public ${noun}, ${most}. Unpublish one to publish this`;
  const higher = offer && offer !== tier ? TIER_LIMITS[offer].publicKnowledgebases : undefined;
  if (higher === undefined) return `${head}.`;
  if (higher === null) return `${head}, or publish as many as you like with ${TIER_NAMES[offer!]}.`;
  return `${head}, or publish up to ${count(higher)} with ${TIER_NAMES[offer!]}.`;
}
