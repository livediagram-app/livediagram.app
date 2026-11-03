// The document's comment threads for the data export (liveworkspace/docs/specs/003-accounts/data-export.md "The apps'
// doors"; docs/specs/015-api/api.md "Internal"): the export door's `comments` format. Every thread on every tab, in the
// tabs' order and each tab's element order, with its comments oldest first and each comment's real author id, never
// redacted: the data export picks out the comments a person wrote by it. Read inside the document's Durable Object,
// from the same tab read the Drive file makes (document-content.ts readContentTabRows); nothing is written.

import type { CommentThread, Element } from '@livedocuments/document';
import {
  ANONYMISED_PERSON,
  type ExportCommentsResult,
  type ExportThread,
} from '@liveworkspace/index-app';
import type { DocumentEnv } from '../types';
import { readContentTabRows, readDocumentHead, type ContentTabRow } from './document-content';

// A thread lives on an element (comments.ts commentThreadOf), one per element, so the element names it: the tab's id
// beside it keeps it unique across the document, as the same element id may sit on two tabs.
const threadId = (tabId: string, elementId: string) => `${tabId}:${elementId}`;

// One tab's threads in the shared shape. A thread with no comments left is no thread. An author id is the account or
// guest that wrote the comment, null when none was recorded or a closed account's name was taken off it.
export function exportThreadsOfTab(tab: {
  id: string;
  name: string;
  elements: readonly Element[];
}): ExportThread[] {
  return tab.elements.flatMap((el) => {
    const thread = (el as { commentThread?: CommentThread }).commentThread;
    if (!thread?.comments.length) return [];
    const comments = [...thread.comments]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((c) => ({
        id: c.id,
        authorId: c.authorId && c.authorId !== ANONYMISED_PERSON ? c.authorId : null,
        authorName: c.authorName || null,
        text: c.text,
        createdAt: c.createdAt,
      }));
    return [
      {
        id: threadId(tab.id, el.id),
        tabId: tab.id,
        tabName: tab.name,
        on: el.id,
        resolved: thread.resolved,
        comments,
      },
    ];
  });
}

// A stored tab's threads. A tab with no thread is not parsed (the text holds no `commentThread`); one whose body does
// not parse is left out, as the comment listing leaves it out (routes/comment-routes.ts listThreads).
function threadsOfRow(row: ContentTabRow): ExportThread[] {
  if (!row.data.includes('"commentThread"')) return [];
  try {
    const body = JSON.parse(row.data) as { elements?: unknown };
    if (!Array.isArray(body.elements)) return [];
    return exportThreadsOfTab({ id: row.id, name: row.name, elements: body.elements as Element[] });
  } catch (err) {
    console.warn('[export] comments skipped tab', { tabId: row.id, error: String(err) });
    return [];
  }
}

// Every thread in the document, or `not_found` for a document not started.
export async function exportDocumentComments(
  env: DocumentEnv,
  documentId: string,
): Promise<ExportCommentsResult> {
  const { meta } = await readDocumentHead(env, documentId);
  if (!meta) return { status: 'not_found' };
  const rows = await readContentTabRows(env, documentId, null);
  return { status: 'ok', threads: rows.flatMap(threadsOfRow) };
}
