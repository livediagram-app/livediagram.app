// The Knowledgebase Style in the document's metadata write (docs/specs/030-knowledgebase/page-surface.md
// "Knowledgebase Style"; docs/specs/015-api/api.md "Documents"): `PUT /api/documents/<id>` takes `knowledgeStyle`,
// any of its fields. The route has already let only an Editor through (in person, or a token granted `write`).
// One row is written and no page: every page is drawn with the style when shown. Every open editor then hears it
// in the `document-meta` op, which a session's own socket can never carry (document-room-frames.ts).
import {
  knowledgeStyleWrite,
  sameKnowledgeStyle,
  type KnowledgeStyle,
} from '@liveknowledge/document';
import { getDocument } from '../db';
import { setKnowledgeStyle } from '../document-room/document-content';
import { json } from '../responses';
import { relayPages } from '../room-client';
import type { DocumentDTO } from '../types';
import type { DocumentRouteContext } from './context';

type Env = DocumentRouteContext['env'];

/** The style a metadata write asks for: null when it names none, the stored style with its fields over it, or the
 *  400 that says which field it could not take. Reads nothing and writes nothing. */
export function readStyleWrite(
  stored: KnowledgeStyle,
  body: { knowledgeStyle?: unknown },
): KnowledgeStyle | Response | null {
  if (body.knowledgeStyle === undefined) return null;
  const read = knowledgeStyleWrite(stored, body.knowledgeStyle);
  if (read.ok) return read.style;
  return json(
    { error: 'invalid_knowledge_style', field: read.field, message: read.message },
    { status: 400 },
  );
}

/** Store the style when it differs from what is held. True when it changed. */
export async function writeStyle(
  env: Env,
  existing: DocumentDTO,
  style: KnowledgeStyle | null,
): Promise<boolean> {
  if (!style || sameKnowledgeStyle(style, existing.knowledgeStyle)) return false;
  if (!(await setKnowledgeStyle(env, existing.id, style, Date.now()))) return false;
  console.info('[knowledge] style', { documentId: existing.id, theme: style.theme });
  return true;
}

/** Tell every open editor, as the document's other metadata goes: the tab list as it stands, and the style. */
export async function relayStyle(env: Env, documentId: string): Promise<void> {
  const after = await getDocument(env, documentId);
  if (!after) return;
  await relayPages(
    env,
    documentId,
    [
      {
        kind: 'document-meta',
        name: after.name,
        knowledgeStyle: after.knowledgeStyle,
        tabs: after.tabs.map((t) => ({
          id: t.id,
          name: t.name,
          orderIndex: t.orderIndex,
          ...(t.folder ? { folder: t.folder } : {}),
          parent: t.parent ?? null,
        })),
      },
    ],
    '[knowledge]',
  );
}
