// Tab stats (docs/specs/013-workspace/explorer-details-view.md "Where the numbers come from"): what
// the Explorer's Details view sums over a document, counted the same way by the api (every tab
// write, the backfill) and by the browser (documents saved only in this browser).
import { opensInOf, type EditorMode } from './editor-mode';

export type TabStats = {
  mode: EditorMode;
  elementCount: number;
  commentCount: number;
  dataBytes: number;
};

// The parts of a stored tab body the stats read.
export type TabStatsBody = {
  kind?: string;
  opensIn?: string;
  layers?: unknown;
  elements?: unknown;
};

const encoder = new TextEncoder();

// One tab's stats from its body and the exact JSON stored for it (bytes as UTF-8, as D1 stores
// them). Every comment counts, resolved threads included.
export function tabStatsOf(body: TabStatsBody, data: string): TabStats {
  const elements = Array.isArray(body.elements) ? (body.elements as unknown[]) : [];
  let commentCount = 0;
  for (const el of elements) {
    const comments = (el as { commentThread?: { comments?: unknown } } | null)?.commentThread
      ?.comments;
    if (Array.isArray(comments)) commentCount += comments.length;
  }
  return {
    mode: opensInOf(body as Parameters<typeof opensInOf>[0]),
    elementCount: elements.length,
    commentCount,
    dataBytes: encoder.encode(data).length,
  };
}
