// What a walkthrough's tier limits say (liveworkspace/docs/specs/006-media/walkthroughs.md "With Pro on"), from the
// numbers the server answered: never worked out here. The tier's name is only known to someone who may see the
// owner's subscription; anyone else reads the limit without it. What the tier above gives is the contract's own
// table, as the pricing page shows it.

import { formatTierLimit, limitRow, TIER_NAMES, type Tier } from '@liveworkspace/subscription';
import { minutesOf } from './limit-state';
import { formatClock } from './timeline';

/** Who the words are for: the owner's tier where this person may know it, and the tier an upgrade would be to where
 *  they may take one. */
export type LimitReader = { tier: Tier | null; upgradeTo: Exclude<Tier, 'free'> | null };

/** "You have 5 walkthroughs, the most Free keeps. Delete one to record another, or keep as many as you like with
 *  Pro." */
export function storedLimitSentence(stored: number, reader: LimitReader): string {
  const count = stored === 1 ? '1 walkthrough' : `${stored} walkthroughs`;
  const most = reader.tier
    ? `the most ${TIER_NAMES[reader.tier]} keeps`
    : 'the most you can keep here';
  const kept = formatTierLimit(limitRow('walkthroughsStored'), reader.upgradeTo ?? 'free');
  const offer =
    reader.upgradeTo && kept === 'Unlimited'
      ? `, or keep as many as you like with ${TIER_NAMES[reader.upgradeTo]}`
      : '';
  return `You have ${count}, ${most}. Delete one to record another${offer}.`;
}

/** The list's quiet line on how long a recording may run, while the tier above records longer: "Free records up to
 *  5 minutes. Pro records up to 30 minutes." for someone who may upgrade; "A walkthrough here records up to 5
 *  minutes." for anyone else. Null when no tier records longer. */
export function lengthNoteWords(
  maxMs: number,
  reader: LimitReader,
): { offer: string; others: string } | null {
  const longest = formatTierLimit(limitRow('walkthroughMaxMs'), 'pro');
  if (longest === minutesOf(maxMs)) return null;
  const longer = reader.upgradeTo
    ? formatTierLimit(limitRow('walkthroughMaxMs'), reader.upgradeTo)
    : null;
  const others = `A walkthrough here records up to ${minutesOf(maxMs)}.`;
  return {
    offer:
      reader.tier && reader.upgradeTo && longer
        ? `${TIER_NAMES[reader.tier]} records up to ${minutesOf(maxMs)}. ${TIER_NAMES[reader.upgradeTo]} records up to ${longer}.`
        : others,
    others,
  };
}

/** The notice once a recording that ran to its limit is saved: "Saved at 5:00", "Your walkthrough reached Free's 5
 *  minutes and is saved in full.", and for someone who may upgrade "Pro records up to 30 minutes." */
export function lengthLimitWords(
  maxMs: number,
  reader: LimitReader,
): { title: string; sentence: string; offer: string } {
  const reached = reader.tier
    ? `${TIER_NAMES[reader.tier]}’s ${minutesOf(maxMs)}`
    : `the ${minutesOf(maxMs)} one may run here`;
  const longer = reader.upgradeTo
    ? formatTierLimit(limitRow('walkthroughMaxMs'), reader.upgradeTo)
    : null;
  return {
    title: `Saved at ${formatClock(maxMs)}`,
    sentence: `Your walkthrough reached ${reached} and is saved in full.`,
    offer:
      reader.upgradeTo && longer && longer !== minutesOf(maxMs)
        ? `${TIER_NAMES[reader.upgradeTo]} records up to ${longer}.`
        : '',
  };
}
