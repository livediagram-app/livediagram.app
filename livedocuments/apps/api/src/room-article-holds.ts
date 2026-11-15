// The room's paragraph holds (docs/specs/007-editor/article-pages.md "Holding a paragraph"), as pure decisions: who
// holds what, whether a claim is given (first claim wins), and the live holds on a tab for the api's held check
// (docs/specs/024-agents/pages-for-agents.md "Held paragraphs"). The room keeps each hold on its session's socket
// attachment (document-room-holds.ts), so a hold survives hibernation and goes with its socket.
import {
  ARTICLE_HOLD_EXPIRE_MS,
  sameHoldPlace,
  type ArticleHoldPlace,
  type ArticleHoldRow,
  type RoomOp,
} from '@livedocuments/api-schema';

/** A hold as a session's attachment keeps it: where, and when its writer last said it. */
export type StoredArticleHold = { tabId: string; at: number } & ArticleHoldPlace;

/** A live session as the holds see it. */
export type HoldingSession = {
  presenceId: string;
  name: string;
  color: string;
  hold: StoredArticleHold | undefined;
};

/** Whether a hold was said again within ARTICLE_HOLD_EXPIRE_MS: past it, it holds nothing. */
export function holdIsLive(hold: StoredArticleHold, now: number): boolean {
  return now - hold.at < ARTICLE_HOLD_EXPIRE_MS;
}

export type HoldVerdict =
  | { kind: 'granted' }
  | { kind: 'refused'; holder: HoldingSession & { hold: StoredArticleHold } };

/** A claim judged against every other live session's hold: refused when one holds the same place on the same tab
 *  and is live, else given. The claimant's own hold never stands in its way (a refresh, or a move). */
export function judgeArticleHold(
  claim: { tabId: string } & ArticleHoldPlace,
  claimant: string,
  sessions: readonly HoldingSession[],
  now: number,
): HoldVerdict {
  for (const s of sessions) {
    const hold = s.hold;
    if (s.presenceId === claimant || !hold || !holdIsLive(hold, now)) continue;
    if (hold.tabId === claim.tabId && sameHoldPlace(hold, claim)) return { kind: 'refused', holder: { ...s, hold } };
  }
  return { kind: 'granted' };
}

/** The `article-hold` op a stored hold is said as, to peers or to a refused claimant. */
export function holdOp(hold: StoredArticleHold): RoomOp {
  return {
    kind: 'article-hold',
    tabId: hold.tabId,
    flow: hold.flow,
    blockId: hold.blockId,
    ...(hold.row !== undefined && hold.col !== undefined ? { row: hold.row, col: hold.col } : {}),
  };
}

/** Every live hold on `tabId`, with who holds it: what the api's held check reads. */
export function liveHoldsOn(
  tabId: string,
  sessions: readonly HoldingSession[],
  now: number,
): ArticleHoldRow[] {
  const out: ArticleHoldRow[] = [];
  for (const s of sessions) {
    const hold = s.hold;
    if (!hold || hold.tabId !== tabId || !holdIsLive(hold, now)) continue;
    out.push({
      flow: hold.flow,
      blockId: hold.blockId,
      ...(hold.row !== undefined && hold.col !== undefined ? { row: hold.row, col: hold.col } : {}),
      name: s.name,
      color: s.color,
    });
  }
  return out;
}
