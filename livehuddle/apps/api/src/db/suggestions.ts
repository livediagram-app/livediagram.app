// suggestions: a Suggestion Box's notes, one row each, in the document's own SQLite (docs/specs/009-elements/
// team-pieces.md "Suggestion Box"): kept beside the content, so no tab read, export, copy or version carries them.
// A row is the note's text and its UTC day; nothing about who dropped it is ever written.

import type { Suggestion } from '@livehuddle/api-schema';
import type { DocumentEnv } from '../types';

export type SuggestionBox = { documentId: string; tabId: string; elementId: string };

/**
 * Drop one note in a box holding fewer than `max`; whether it landed. The count and the insert are one statement, so
 * two drops racing for a box's last place can't both land past the cap (a count, then an insert, could).
 */
export async function insertSuggestion(
  env: DocumentEnv,
  box: SuggestionBox,
  note: Suggestion,
  max: number,
): Promise<boolean> {
  const res = await env.DOCUMENT_DB.prepare(
    `INSERT INTO suggestions (id, document_id, tab_id, element_id, text, day)
       SELECT ?, ?, ?, ?, ?, ?
        WHERE (SELECT COUNT(*) FROM suggestions WHERE document_id = ? AND tab_id = ? AND element_id = ?) < ?`,
  )
    .bind(
      note.id,
      box.documentId,
      box.tabId,
      box.elementId,
      note.text,
      note.day,
      box.documentId,
      box.tabId,
      box.elementId,
      max,
    )
    .run();
  return (res.meta.changes ?? 0) > 0;
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
