import { apiAiReadNotes } from '@/lib/api/ai';
import { readCropsInBrowser } from './browser-reader';
import type { CropReader, ReadText } from './types';

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
// Detection is in-browser either way: only crops of individual notes are ever
// sent, never the photograph (spec/139).

export type ReaderKind = 'server' | 'browser';

export type SelectedReader = { kind: ReaderKind; read: CropReader };

export function selectReader(deps: { aiEnabled: boolean; ownerId: string }): SelectedReader {
  if (deps.aiEnabled) {
    return {
      kind: 'server',
      read: async (crops, opts) => {
        const answer = await apiAiReadNotes(deps.ownerId, crops, opts);
        const out = new Map<number, ReadText>();
        for (const t of answer.texts) out.set(t.id, { text: t.text, legible: t.legible });
        return out;
      },
    };
  }
  return { kind: 'browser', read: (crops, opts) => readCropsInBrowser(crops, opts) };
}
