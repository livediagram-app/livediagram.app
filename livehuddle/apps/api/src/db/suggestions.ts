// suggestions — a Suggestion Box's notes, one row each, in the document's own SQLite (docs/specs/009-elements/
// team-pieces.md "Suggestion Box"): kept beside the content, so no tab read, export, copy or version carries them.
// A row is the note's text and its UTC day; nothing about who dropped it is ever written.

import type { Suggestion } from '@livehuddle/api-schema';
import type { DocumentEnv } from '../types';

export type SuggestionBox = { documentId: string; tabId: string; elementId: string };

/** How many notes a box holds now. */
export async function countSuggestions(env: DocumentEnv, box: SuggestionBox): Promise<number> {
  const row = await env.DOCUMENT_DB.prepare(
    'SELECT COUNT(*) AS n FROM suggestions WHERE document_id = ? AND tab_id = ? AND element_id = ?',
  )
    .bind(box.documentId, box.tabId, box.elementId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Drop one note in a box. */
export async function insertSuggestion(
  env: DocumentEnv,
  box: SuggestionBox,
  note: Suggestion,
): Promise<void> {
  await env.DOCUMENT_DB.prepare(
    'INSERT INTO suggestions (id, document_id, tab_id, element_id, text, day) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(note.id, box.documentId, box.tabId, box.elementId, note.text, note.day)
    .run();
}

/** A box's notes, newest first. */
export async function listSuggestions(env: DocumentEnv, box: SuggestionBox): Promise<Suggestion[]> {
  const { results } = await env.DOCUMENT_DB.prepare(
    `SELECT id, text, day FROM suggestions
      WHERE document_id = ? AND tab_id = ? AND element_id = ?
      ORDER BY rowid DESC`,
  )
    .bind(box.documentId, box.tabId, box.elementId)
    .all<Suggestion>();
  return results.map((r) => ({ id: r.id, text: r.text, day: r.day }));
}

/** Remove one note from a tab's boxes; whether there was one. */
export async function deleteSuggestion(
  env: DocumentEnv,
  documentId: string,
  tabId: string,
  id: string,
): Promise<boolean> {
  const row = await env.DOCUMENT_DB.prepare(
    'DELETE FROM suggestions WHERE document_id = ? AND tab_id = ? AND id = ? RETURNING id',
  )
    .bind(documentId, tabId, id)
    .first<{ id: string }>();
  return row !== null;
}
