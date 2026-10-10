// A tab's articles' writing as `article` room ops (docs/specs/007-editor/article-pages.md
// "Collaboration"): per article, its block ops in frames the room will carry, or that it is gone.
// Shared by the editor's broadcast and the api's relay of an agent's write
// (docs/specs/024-agents/illustrate-for-agents.md "The route"), so both send the same frames.
import { articlesOf, diffArticleFlow, type ArticleOp, type Tab } from '@livediagram/document';
import type { RoomOp } from './room-messages';

// The most characters of block ops one `article` frame carries: well inside the room's 256K cap on a
// message (apps/api/src/document-room.ts MAX_MESSAGE_CHARS), with room for the envelope.
export const ARTICLE_FRAME_CHARS = 200_000;

type ArticlesTab = Pick<Tab, 'id'> & { articles?: unknown };

/** The `article` ops from `before`'s writing to `after`'s. The stored articles are compared by
 *  identity first, so an untouched article costs nothing. `agent` marks an agent's write. */
export function tabArticleOps(
  before: ArticlesTab,
  after: ArticlesTab,
  { agent = false }: { agent?: boolean } = {},
): RoomOp[] {
  if (before.articles === after.articles) return [];
  const was = articlesOf(before);
  const now = articlesOf(after);
  const ops: RoomOp[] = [];
  for (const flow of Object.keys(was)) {
    if (!(flow in now)) ops.push({ kind: 'article', tabId: after.id, flow, removed: true });
  }
  const marks = agent ? { agent: true as const } : {};
  for (const [flow, doc] of Object.entries(now)) {
    if (was[flow] === doc) continue;
    // In frames the room will carry (it drops one over 256K characters): ops in order, a frame
    // closing before it would pass ARTICLE_FRAME_CHARS. Applied in order, the frames compose.
    const created = was[flow] ? {} : { created: true as const };
    let frame: ArticleOp[] = [];
    let chars = 0;
    for (const op of diffArticleFlow(was[flow], doc)) {
      const size = JSON.stringify(op).length;
      if (frame.length > 0 && chars + size > ARTICLE_FRAME_CHARS) {
        ops.push({ kind: 'article', tabId: after.id, flow, ops: frame, ...created, ...marks });
        frame = [];
        chars = 0;
      }
      frame.push(op);
      chars += size;
    }
    if (frame.length > 0)
      ops.push({ kind: 'article', tabId: after.id, flow, ops: frame, ...created, ...marks });
  }
  return ops;
}
