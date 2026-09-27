// Microsoft Whiteboard import, the entry point
// (docs/specs/020-import-export/whiteboard-import.md, blueprint "Entry"): one
// file in, the board's elements (board route) or its picture (picture route)
// out, or a named refusal. Pure of the editor: the caller stores images and
// commits, so a bulk importer can call this once per file.

import { MAX_ELEMENTS_PER_TAB, type Element } from '@livediagram/diagram';
import type { AcceptedImageType } from '@livediagram/api-schema';
import { fnv1a32 } from '@/lib/fnv1a';
import { readBoard } from './canvas';
import { convertBoard, type WhiteboardTally } from './convert';
import { readWhiteboardFile } from './envelope';
import { fitToTab } from './fit';
import { WHITEBOARD_MAX_FILE_BYTES, WHITEBOARD_TAB_BYTES_BUDGET } from './limits';
import { refusalMessage, type WhiteboardRefusal } from './refusals';

export type WhiteboardImportResult =
  | {
      ok: true;
      route: 'board';
      title: string;
      sourceId: string;
      elements: Element[];
      tally: WhiteboardTally;
      /** Strokes were simplified past full detail to fit the tab. */
      simplified: boolean;
      backgroundColor?: string;
    }
  | { ok: true; route: 'picture'; title: string; blob: Blob; mimeType: AcceptedImageType }
  | { ok: false; refusal: WhiteboardRefusal; error: string };

const refuse = (refusal: WhiteboardRefusal, detail?: unknown): WhiteboardImportResult => {
  console.warn('[whiteboard-import]', 'refused', { refusal, detail });
  return { ok: false, refusal, error: refusalMessage(refusal) };
};

const hex8 = (n: number) => n.toString(16).padStart(8, '0');

async function run(file: {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}): Promise<WhiteboardImportResult> {
  if (file.bytes.length > WHITEBOARD_MAX_FILE_BYTES) return refuse('too-large');
  const read = await readWhiteboardFile(file);
  if (!read.ok) return refuse(read.refusal);
  if (read.route === 'picture') {
    return {
      ok: true,
      route: 'picture',
      title: read.title,
      blob: read.blob,
      mimeType: read.mimeType,
    };
  }
  const board = readBoard(read.doc);
  if (!board.ok) return refuse(board.refusal);
  const converted = convertBoard(board);
  if (converted.unknownTransforms.length > 0) {
    console.info('[whiteboard-import]', 'unknown-transform', converted.unknownTransforms);
  }
  const fitted = fitToTab(converted.items, {
    bytesBudget: WHITEBOARD_TAB_BYTES_BUDGET,
    maxElements: MAX_ELEMENTS_PER_TAB,
  });
  if (!fitted.ok) return refuse('board-too-large', { items: converted.items.length });
  const ids = board.items.map((i) => i.id).sort();
  return {
    ok: true,
    route: 'board',
    title: read.title,
    sourceId: `mswb:${read.title}:${hex8(fnv1a32(ids.join('\n')))}`,
    elements: fitted.elements,
    tally: converted.tally,
    simplified: fitted.rounds > 1,
    ...(converted.backgroundColor ? { backgroundColor: converted.backgroundColor } : {}),
  };
}

/** One Whiteboard export to livediagram content, never throwing. */
export async function importWhiteboard(file: {
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}): Promise<WhiteboardImportResult> {
  try {
    return await run(file);
  } catch (error) {
    return refuse('unreadable', String(error));
  }
}
