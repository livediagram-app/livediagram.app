import type { NoteCrop } from '@livediagram/api-schema';
import { apiAiReadNotes } from '@/lib/api/ai';
import { readCropsInBrowser } from './browser-reader';
import {
  normaliseRead,
  type CropReader,
  type ReadOptions,
  type ReadResult,
  type ReadText,
} from './types';

// WHO reads the handwriting (spec/139 Phase 9).
//
// Two readers, one interface, and the choice is made by what the deployment
// has rather than by what the author asks for:
//
//   a model configured on the api  → the SERVER reads (crops are uploaded)
//   no model configured            → the BROWSER reads (nothing leaves)
//
// The server wins when it exists because it is markedly better — measured on a
// real wall, a hosted model reads 99% of the words against ~80% for the
// largest model worth downloading (docs/vision/handwriting-readers.md). The
// browser reader is what makes the import work with NO key at all, which is
// the case every self-host starts in.
//
// When the server's budget is spent (`ai_quota`), the notes it did not read
// are read in the browser instead, and the review is told so. Whose budget it
// was is not said.
//
// Detection is in-browser either way: only crops of individual notes are ever
// sent, never the photograph (spec/139).

export type ReaderKind = 'server' | 'browser';

export type SelectedReader = { kind: ReaderKind; read: CropReader };

const readInBrowser: CropReader = async (crops, opts) => {
  const read = await readCropsInBrowser(crops, opts);
  return read.failure
    ? { textById: read.textById, failure: read.failure, detail: read.detail }
    : { textById: read.textById };
};

function serverReader(ownerId: string): CropReader {
  return async (crops, opts) => {
    const answer = await apiAiReadNotes(ownerId, crops, opts);
    const out = new Map<number, ReadText>();
    for (const t of answer.texts) {
      const read = normaliseRead(t.text);
      // The provider's own "I could not read this" still wins: it knows
      // something the text alone does not.
      out.set(t.id, t.legible ? read : { text: read.text, legible: false });
    }
    return answer.failure === undefined
      ? { textById: out }
      : { textById: out, unread: answer.unread ?? 0, failure: answer.failure };
  };
}

// The server first; the crops it did not read because its budget is spent go
// to the device reader, whose progress carries on from the server's count.
export function withBudgetFailover(server: CropReader, device: CropReader): CropReader {
  return async (crops: NoteCrop[], opts: ReadOptions): Promise<ReadResult> => {
    let served: ReadResult;
    try {
      served = await server(crops, opts);
    } catch (err) {
      if (!(err instanceof Error) || err.message !== 'ai_quota') throw err;
      served = { textById: new Map(), unread: crops.length, failure: 'ai_quota' };
    }
    if (served.failure !== 'ai_quota') return served;
    const rest = crops.filter((c) => !served.textById.has(c.id));
    const already = served.textById.size;
    console.warn(
      `[reader] the free budget is spent; reading ${rest.length} of ${crops.length} notes on this device`,
    );
    opts.onFallback?.('budget');
    const here = await device(rest, {
      ...opts,
      onProgress: (n) => opts.onProgress?.(already + n),
    });
    const textById = new Map([...served.textById, ...here.textById]);
    return here.failure
      ? { textById, failure: here.failure, detail: here.detail, fallback: 'budget' }
      : { textById, fallback: 'budget' };
  };
}

export function selectReader(deps: { aiEnabled: boolean; ownerId: string }): SelectedReader {
  if (deps.aiEnabled) {
    return { kind: 'server', read: withBudgetFailover(serverReader(deps.ownerId), readInBrowser) };
  }
  return { kind: 'browser', read: readInBrowser };
}
