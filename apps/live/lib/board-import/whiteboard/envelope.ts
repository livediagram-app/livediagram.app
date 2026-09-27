// What a picked file is (docs/specs/020-import-export/blueprints/whiteboard-import.md "Envelope"):
// a Full export Zip or its extracted HTML takes the board route, a picture the
// picture route. Decided by the bytes, never the file name.

import { sniffImageType, type AcceptedImageType } from '@livediagram/api-schema';
import { isWhiteboardCanvas } from './canvas';
import { WHITEBOARD_MAX_INFLATED_BYTES } from './limits';
import type { WhiteboardRefusal } from './refusals';
import { ByteBudget, listZip, readZipEntry, type ZipEntry } from './zip';

export type WhiteboardFile =
  | { ok: true; route: 'board'; title: string; doc: Document; comments: unknown }
  | { ok: true; route: 'picture'; title: string; blob: Blob; mimeType: AcceptedImageType };

export type WhiteboardFileResult = WhiteboardFile | { ok: false; refusal: WhiteboardRefusal };

const UNTITLED = 'Whiteboard';

const isZip = (b: Uint8Array) =>
  b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5);

const stem = (name: string) => {
  const base = name.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(0, dot) : base;
};

const titleOf = (name: string) => stem(name).trim() || UNTITLED;

const parseHtml = (text: string) => new DOMParser().parseFromString(text, 'text/html');

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

function boardOrRefusal(doc: Document, title: string, comments: unknown): WhiteboardFileResult {
  if (!doc.querySelector('.canvasChildElement')) return { ok: false, refusal: 'empty-board' };
  return { ok: true, route: 'board', title, doc, comments };
}

async function readComments(
  bytes: Uint8Array<ArrayBuffer>,
  entries: ZipEntry[],
  boardName: string,
  budget: ByteBudget,
): Promise<unknown> {
  const wanted = `${boardName.slice(0, -'.html'.length)}-comments.json`.toLowerCase();
  const entry = entries.find((e) => e.name.toLowerCase() === wanted);
  if (!entry) return null;
  const read = await readZipEntry(bytes, entry, budget);
  if (!read.ok) return null;
  try {
    return JSON.parse(decode(read.bytes)) as unknown;
  } catch {
    console.info('[whiteboard-import]', 'comments-unreadable', { entry: entry.name });
    return null;
  }
}

async function readZipBoard(bytes: Uint8Array<ArrayBuffer>): Promise<WhiteboardFileResult> {
  const listed = listZip(bytes);
  if (!listed.ok) return listed;
  const budget = new ByteBudget(WHITEBOARD_MAX_INFLATED_BYTES);
  const candidates = listed.entries.filter(
    (e) => e.name.toLowerCase().endsWith('.html') && !e.name.startsWith('__MACOSX/'),
  );
  const boards: { entry: ZipEntry; doc: Document }[] = [];
  for (const entry of candidates) {
    const read = await readZipEntry(bytes, entry, budget);
    if (!read.ok) return read;
    const doc = parseHtml(decode(read.bytes));
    if (isWhiteboardCanvas(doc)) boards.push({ entry, doc });
  }
  console.info('[whiteboard-import]', 'envelope', {
    route: 'zip',
    entries: listed.entries.length,
    boards: boards.length,
  });
  if (boards.length === 0) return { ok: false, refusal: 'not-whiteboard' };
  if (boards.length > 1) return { ok: false, refusal: 'several-boards' };
  const [{ entry, doc }] = boards as [{ entry: ZipEntry; doc: Document }];
  const comments = await readComments(bytes, listed.entries, entry.name, budget);
  return boardOrRefusal(doc, titleOf(entry.name), comments);
}

/** The route and content of a picked file, or a named refusal. */
export async function readWhiteboardFile(file: {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}): Promise<WhiteboardFileResult> {
  const { bytes } = file;
  if (isZip(bytes)) return readZipBoard(bytes);
  const mimeType = sniffImageType(bytes);
  if (mimeType) {
    console.info('[whiteboard-import]', 'envelope', { route: 'picture', mimeType });
    return {
      ok: true,
      route: 'picture',
      title: titleOf(file.name),
      blob: new Blob([bytes as BlobPart], { type: mimeType }),
      mimeType,
    };
  }
  const doc = parseHtml(decode(bytes));
  if (!isWhiteboardCanvas(doc)) return { ok: false, refusal: 'not-whiteboard' };
  console.info('[whiteboard-import]', 'envelope', { route: 'html' });
  return boardOrRefusal(doc, titleOf(file.name), null);
}
