// Knowledgebase Pages with Pro on (docs/specs/030-knowledgebase/tiers.md "Knowledgebase Pages"): what bounds the open
// knowledgebase's pages, either its fixed per-knowledgebase bound or the owner's limit over every knowledgebase they
// own, and the words of the import's offer to take the first pages that fit, of a full knowledgebase and of the
// finished import's note.
import { TIER_LIMITS, type Tier } from '@liveworkspace/subscription';

const count = (n: number) => n.toLocaleString('en-US');
const TIER_WORDS: Record<Tier, string> = { free: 'Free', pro: 'Pro', team: 'Pro for Teams' };

/** The tier whose Knowledgebase Pages `limit` is, so the words can name it; null for a figure no tier has. */
export function pagesTierOf(limit: number): Tier | null {
  return (
    (Object.keys(TIER_LIMITS) as Tier[]).find((t) => TIER_LIMITS[t].knowledgebasePages === limit) ??
    null
  );
}

/**
 * What bounds the open knowledgebase: `max` is the most pages it may hold in all. `account` is set when that is the
 * owner's Knowledgebase Pages, not the per-knowledgebase bound: their limit, and whose it is ('yours' or 'team'). It
 * is only known to the owner and the owning team, whose own subscription says what they used.
 */
export type PagesBound = {
  max: number;
  account: { limit: number; whose: 'yours' | 'team' } | null;
};

/** The bound for a knowledgebase holding `existing` pages: its fixed `perKnowledgebase`, or less when the owner's
 *  `used` of `limit` (over all their knowledgebases, this one's `existing` among them) leaves less room. */
export function pagesBound(
  existing: number,
  perKnowledgebase: number,
  account: { used: number; limit: number; whose: 'yours' | 'team' } | null,
): PagesBound {
  if (!account) return { max: perKnowledgebase, account: null };
  // The owner's other knowledgebases: their total less this one's count as last told.
  const others = Math.max(0, account.used - existing);
  const byAccount = Math.max(0, account.limit - others);
  return byAccount < perKnowledgebase
    ? { max: byAccount, account: { limit: account.limit, whose: account.whose } }
    : { max: perKnowledgebase, account: null };
}

const across = (whose: 'yours' | 'team') =>
  whose === 'yours' ? 'across your Knowledgebases' : 'across this team’s Knowledgebases';

export type TrimOffer = { title: string; detail: string; importLabel: string };

/** "42 more pages fit on Free", what happens to the rest, and Import First 42. */
export function trimOffer(found: number, room: number, bound: PagesBound): TrimOffer {
  const leftOut = found - room;
  const fits = `${count(room)} more ${room === 1 ? 'page fits' : 'pages fit'}`;
  const rest = `We'll import the first ${count(room)}, in the export's order, and leave out the other ${count(leftOut)}.`;
  const importLabel = `Import First ${count(room)}`;
  if (!bound.account)
    return {
      title: fits,
      detail: `A Knowledgebase holds ${count(bound.max)} pages. ${rest}`,
      importLabel,
    };
  const tier = pagesTierOf(bound.account.limit);
  const name = tier ? TIER_WORDS[tier] : null;
  const higher =
    tier === 'free' && bound.account.whose === 'yours'
      ? ` Pro holds ${count(TIER_LIMITS.pro.knowledgebasePages)}.`
      : '';
  return {
    title: `${fits}${name ? ` on ${name}` : ''}`,
    detail: `${name ?? 'Your plan'} holds ${count(bound.account.limit)} pages ${across(bound.account.whose)}. ${rest}${higher}`,
    importLabel,
  };
}

/** A full knowledgebase: "You have 500 pages, the most Free holds across your Knowledgebases." */
export function fullSentence(bound: PagesBound): string {
  if (!bound.account)
    return `This Knowledgebase holds ${count(bound.max)} pages, the most one can.`;
  const tier = pagesTierOf(bound.account.limit);
  const most = tier ? `the most ${TIER_WORDS[tier]} holds` : 'the most you can hold';
  const limit = count(bound.account.limit);
  return bound.account.whose === 'yours'
    ? `You have ${limit} pages, ${most} across your Knowledgebases.`
    : `This team has ${limit} pages, ${most} across its Knowledgebases.`;
}

/** "Imported 42 of 84 pages. The other 42 were left out: your Knowledgebases are full on Free." */
export function trimmedToast(imported: number, leftOut: number, bound: PagesBound): string {
  const head = `Imported ${count(imported)} of ${count(imported + leftOut)} pages. The other ${count(leftOut)} were left out:`;
  if (!bound.account) return `${head} this Knowledgebase is full.`;
  const tier = pagesTierOf(bound.account.limit);
  const on = tier ? ` on ${TIER_WORDS[tier]}` : '';
  return bound.account.whose === 'yours'
    ? `${head} your Knowledgebases are full${on}.`
    : `${head} this team’s Knowledgebases are full${on}.`;
}
