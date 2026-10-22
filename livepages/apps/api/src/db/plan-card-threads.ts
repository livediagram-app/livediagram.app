// The Inbox's Plan card comment threads (docs/specs/013-workspace/inbox.md §2.5). A card's thread
// lives in its item (`fields.comments`), not in tab JSON, so the read filters `items` directly, as the Plan cards
// read does (§2.4), and places each card on a board the same way (`itemPlacementCtes`).

import type { ActivityCardThread } from '@livediagram/api-schema';
import { itemPlacementCtes } from './plan-board-index';

// The thread's comments, and the comments' mentions, as rows SQLite can test.
const COMMENTS = `json_each(i.fields, '$.comments.comments')`;
const LATEST = `'$.comments.comments[#-1]`;

// Appended to the Activity read's scope CTEs (?1 owner, ?2 now, ?3 limit; `me` and `my_members` from there). A
// thread is listed while it holds a comment and is not resolved, on a card neither archived nor in the Trash,
// when the reader wrote in it, is mentioned in it, or owns the document. Author ids stay in the worker: only the
// latest author's name and colour leave it.
export const CARD_THREADS_CTES = itemPlacementCtes({
  match: `json_extract(i.fields, '$.comments.resolved') = 0
       AND json_array_length(i.fields, '$.comments.comments') > 0
       AND json_extract(i.fields, '$.archived') IS NOT 1
       AND json_extract(i.fields, '$.status') IS NOT 'trash'`,
  cols: `json_array_length(i.fields, '$.comments.comments') AS comment_count,
           json_extract(i.fields, ${LATEST}.text') AS latest_text,
           json_extract(i.fields, ${LATEST}.authorName') AS latest_author_name,
           json_extract(i.fields, ${LATEST}.authorColor') AS latest_author_color,
           json_extract(i.fields, ${LATEST}.createdAt') AS latest_at,
           json_extract(i.fields, '$.comments.comments[0].createdAt') AS first_at,
           CASE WHEN EXISTS (SELECT 1 FROM ${COMMENTS} c
                              WHERE json_extract(c.value, '$.authorId') IN (SELECT id FROM me))
                THEN 1 ELSE 0 END AS you_commented,
           CASE WHEN v.owner_id = ?1 THEN 1 ELSE 0 END AS on_your_document,
           CASE WHEN EXISTS (SELECT 1 FROM ${COMMENTS} c, json_each(c.value, '$.mentions') m
                              WHERE json_extract(m.value, '$.userId') IN (SELECT id FROM me)
                                 OR json_extract(m.value, '$.memberId') IN (SELECT id FROM my_members))
                THEN 1 ELSE 0 END AS mentions_you`,
  keep: 'on_your_document = 1 OR you_commented = 1 OR mentions_you = 1',
  order: 'latest_at',
});

export const CARD_THREADS_SELECT = `
  SELECT document_id, id, item_key, type, title, document_name, document_team_id, via, share_code, board,
         comment_count, latest_text, latest_author_name, latest_author_color, latest_at, first_at,
         you_commented, on_your_document, mentions_you
    FROM placed
   ORDER BY latest_at DESC`;

export type CardThreadRow = {
  document_id: string;
  id: string;
  item_key: number;
  type: string;
  title: string | null;
  document_name: string;
  document_team_id: string | null;
  via: 'own' | 'team' | 'shared';
  share_code: string | null;
  board: string | null;
  comment_count: number;
  latest_text: string | null;
  latest_author_name: string | null;
  latest_author_color: string | null;
  latest_at: number | null;
  first_at: number | null;
  you_commented: number;
  on_your_document: number;
  mentions_you: number;
};

// A 'shared' row whose link has lapsed never arrives: `visible` (document-visibility.ts) drops it.
export function cardThreadsFromRows(rows: readonly CardThreadRow[]): ActivityCardThread[] {
  return rows.map((r) => ({
    documentId: r.document_id,
    documentName: r.document_name,
    teamId: r.document_team_id,
    via: r.via,
    shareCode: r.via === 'shared' ? r.share_code : null,
    board: r.board ? (JSON.parse(r.board) as ActivityCardThread['board']) : null,
    id: r.id,
    key: r.item_key,
    type: r.type,
    title: typeof r.title === 'string' ? r.title : '',
    commentCount: r.comment_count,
    latest: {
      text: r.latest_text ?? '',
      authorName: r.latest_author_name ?? '',
      authorColor: r.latest_author_color ?? '',
      at: r.latest_at ?? 0,
    },
    firstAt: r.first_at ?? 0,
    youCommented: r.you_commented === 1,
    onYourDocument: r.on_your_document === 1,
    mentionsYou: r.mentions_you === 1,
  }));
}
