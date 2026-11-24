// Send to Knowledge Base arriving here (docs/specs/013-workspace/send-to-knowledge.md "The door"; the platform's
// liveworkspace/docs/specs/004-index/send-to-knowledge.md): a page's headings for the picker, and the section written
// as the person, on their Editor grant (checked by the internal door before this runs). The write goes through the
// knowledgebase's own routes as that person, never as a rule or an agent, so it is made, gated, relayed to open
// editors, stamped and told to watchers exactly as their own write in the editor is:
//   a new page   POST pages {title, parent?}
//   the section  PUT pages/<tab> {markdown, mode: 'append', after?, picture?}
// The picture is stored in the person's Library through the media service first; a picture the service refuses
// leaves the section without one rather than unwritten.
import {
  knowledgeSentFromLine,
  type KnowledgeSendDoorAnswer,
  type KnowledgeSendDoorCall,
  type KnowledgeSendPicture,
} from '@liveworkspace/index-client';
import { PICTURE_MARK, articleHeadings } from '@liveknowledge/edit-operations';
import { savedArticlesOf } from '@liveknowledge/document';
import type { DocumentGrant } from '../index-service';
import { mediaClient, mediaOwner, rememberMediaOwner } from '../media';
import type { DocumentEnv } from '../types';
import { readStoredTab } from '../changesets/stored-tab';
import { documentTabUrl } from './automations/kit-outline';
import type { DocumentRoom } from './document-room';
import { route } from './document-room-doors';
import type { RouteIdentity } from './document-route';

// The room's door's shapes, so its method stays a line or two (document-room.ts stays under 800 lines).
export type SendCall = KnowledgeSendDoorCall;
export type SendAnswer = KnowledgeSendDoorAnswer;

// The room's own requests: never on the network, the origin only names them.
const ROOM_ORIGIN = 'https://liveknowledge.internal';
const HEADINGS_MAX = 200;

/** The identity the knowledgebase's routes read for a send: the person, in person, on their grant. */
export const personIdentity = (person: string, grant: DocumentGrant): RouteIdentity => ({
  accountUserId: person,
  verifiedUserId: person,
  accountEmail: null,
  owner: person,
  token: null,
  workbench: null,
  teams: null,
  bearer: null,
  grant,
});

const asJson = (body: unknown, method: string) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const refused = (code: string, reason: string): KnowledgeSendDoorAnswer => ({
  ok: false,
  code,
  reason,
});

/** A PNG's size from its header (IHDR), or null for bytes that are no PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function base64Bytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** The picture stored in the person's Library: its image id, or null where it could not be. */
async function storePicture(
  env: DocumentEnv,
  documentId: string,
  person: string,
  picture: KnowledgeSendPicture,
): Promise<string | null> {
  const media = mediaClient(env);
  const bytes = base64Bytes(picture.png);
  const size = bytes && pngSize(bytes);
  if (!media || !bytes || !size) return null;
  const owner = await mediaOwner(person);
  const uploaded = await media
    .upload({
      owner,
      bytes: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
      contentType: 'image/png',
      byteSize: bytes.byteLength,
      width: size.width,
      height: size.height,
      originalName: 'selection.png',
      document: documentId,
    })
    .catch(() => null);
  if (!uploaded?.ok) {
    console.warn('[knowledge-send] picture not stored');
    return null;
  }
  rememberMediaOwner(uploaded.value.image.id, owner);
  return uploaded.value.image.id;
}

/** The section's Markdown: the heading, the words, the picture's place, and the Sent From line. */
export function sectionMarkdown(
  call: Extract<KnowledgeSendDoorCall, { op: 'write' }>,
  withPicture: boolean,
): string {
  const parts: string[] = [];
  const heading = call.heading.trim();
  if (heading) parts.push(`## ${heading.replaceAll('\n', ' ')}`);
  parts.push(call.markdown.trim());
  if (withPicture) parts.push(PICTURE_MARK);
  parts.push(knowledgeSentFromLine(call.sentFrom));
  return parts.join('\n\n');
}

async function outline(
  room: DocumentRoom,
  documentId: string,
  page: string,
): Promise<KnowledgeSendDoorAnswer> {
  const stored = await readStoredTab(room.requireEnv(), documentId, page);
  if (!stored) return refused('page_gone', 'That page is no longer there');
  const flow = Object.values(savedArticlesOf(stored.tab))[0];
  return { ok: true, headings: flow ? articleHeadings(flow).slice(0, HEADINGS_MAX) : [] };
}

async function write(
  room: DocumentRoom,
  documentId: string,
  call: Extract<KnowledgeSendDoorCall, { op: 'write' }>,
  identity: RouteIdentity,
): Promise<KnowledgeSendDoorAnswer> {
  const env = room.requireEnv();
  const base = `${ROOM_ORIGIN}/api/documents/${encodeURIComponent(documentId)}/pages`;
  const imageId = call.picture
    ? await storePicture(env, documentId, call.person, call.picture)
    : null;

  // A new page first, as create_page makes one: the person's own, never verified, where they placed it.
  let pageId: string;
  let title: string;
  if ('newPage' in call.place) {
    const { newPage } = call.place;
    const made = await route(
      room,
      documentId,
      new Request(
        base,
        asJson(
          { title: newPage.title, ...(newPage.parent ? { parent: newPage.parent } : {}) },
          'POST',
        ),
      ),
      identity,
    );
    const body = (await made.json().catch(() => null)) as {
      page?: { tab?: string; title?: string };
      error?: string;
      message?: string;
    } | null;
    if (made.status !== 201 || !body?.page?.tab) {
      if (made.status === 403) return refused('no_access', '');
      if (made.status === 404 || body?.error === 'page_unknown')
        return refused('page_gone', 'The parent page is no longer there');
      if (made.status === 409 && body?.error !== 'page_exists')
        return refused(
          'pages_full',
          body?.message || "The knowledgebase can't take another page there",
        );
      return refused('failed', body?.message || "Couldn't make the page");
    }
    pageId = body.page.tab;
    title = body.page.title ?? newPage.title;
    // Its Owner is the person: the one who answers for it until someone verifies it.
    const owned = await route(
      room,
      documentId,
      new Request(
        `${base}/${encodeURIComponent(pageId)}/knowledge`,
        asJson({ owner: call.person }, 'PUT'),
      ),
      identity,
    );
    await owned.body?.cancel();
  } else {
    pageId = call.place.page;
    title = '';
  }

  const picture =
    imageId && call.picture
      ? {
          imageId,
          width: call.picture.width,
          height: call.picture.height,
          alt: call.heading || title || 'The selection',
        }
      : null;
  const wrote = await route(
    room,
    documentId,
    new Request(
      `${base}/${encodeURIComponent(pageId)}`,
      asJson(
        {
          markdown: sectionMarkdown(call, !!picture),
          mode: 'append',
          ...('page' in call.place && call.place.after ? { after: call.place.after } : {}),
          ...(picture ? { picture } : {}),
        },
        'PUT',
      ),
    ),
    identity,
  );
  const body = (await wrote.json().catch(() => null)) as {
    error?: string;
    message?: string;
    tab?: { id?: string };
  } | null;
  if (wrote.status !== 200) {
    if (wrote.status === 403) return refused('no_access', '');
    if (wrote.status === 404) return refused('page_gone', 'That page is no longer there');
    const code =
      body?.error === 'heading_unknown' || body?.error === 'page_locked' ? body.error : 'failed';
    return refused(code, body?.message || "Couldn't write on the page");
  }
  if (!title) {
    const stored = await readStoredTab(env, documentId, pageId);
    title = stored?.tab.name ?? '';
  }
  console.info('[knowledge-send] written', {
    documentId,
    tabId: pageId,
    newPage: 'newPage' in call.place,
    picture: !!picture,
  });
  return { ok: true, page: { id: pageId, title }, link: documentTabUrl(env, documentId, pageId) };
}

export async function knowledgeSendDoor(
  room: DocumentRoom,
  documentId: string,
  call: KnowledgeSendDoorCall,
  grant: DocumentGrant,
): Promise<KnowledgeSendDoorAnswer> {
  room.bindDocument(documentId);
  if (!room.storedSchema()) return refused('no_access', '');
  if (call.op === 'outline') return outline(room, documentId, call.page);
  return write(room, documentId, call, personIdentity(call.person, grant));
}
