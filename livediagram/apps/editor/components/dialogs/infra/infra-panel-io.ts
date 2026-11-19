// What both infrastructure panels share: choosing and dropping files (each past the cap refused unread, named), and
// running an import or update with the busy and error states the other import panels have.

import { useState } from 'react';
import { pickTabFile, pickTabFiles, type ImportOutcome } from '@/lib/import-tab';
import { INFRA_FILE_ACCEPT, INFRA_FILE_MAX_BYTES, INFRA_TOO_LARGE } from '@/lib/infra-import';

type Read = { files: { name: string; text: string }[]; refused: string[] };

const refusal = (name: string) => `${name}: ${INFRA_TOO_LARGE}`;

function split(picked: readonly { name: string; text: string; tooBig?: true }[]): Read {
  const out: Read = { files: [], refused: [] };
  for (const p of picked) {
    if (p.tooBig) out.refused.push(refusal(p.name));
    else out.files.push({ name: p.name, text: p.text });
  }
  return out;
}

// The picker, several files at once; null when it was dismissed.
export async function chooseInfraFiles(): Promise<Read | null> {
  const picked = await pickTabFiles(INFRA_FILE_ACCEPT, { maxBytes: INFRA_FILE_MAX_BYTES });
  return picked ? split(picked) : null;
}

// The picker for one file (a row's Choose File).
export async function chooseInfraFile(): Promise<Read | null> {
  const picked = await pickTabFile(INFRA_FILE_ACCEPT, { maxBytes: INFRA_FILE_MAX_BYTES });
  return picked ? split([picked]) : null;
}

// Dropped files, read as the picker reads them.
export async function readDroppedInfraFiles(data: DataTransfer): Promise<Read> {
  const read = await Promise.all(
    [...data.files].map(async (f) =>
      f.size > INFRA_FILE_MAX_BYTES
        ? { name: f.name, text: '', tooBig: true as const }
        : { name: f.name, text: await f.text() },
    ),
  );
  return split(read);
}

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

export function useInfraRun(onDone: (outcome: DoneOutcome) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (runner: () => Promise<ImportOutcome>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    // A runner that throws must still hand the panel back, as the other import panels' do.
    const outcome = await runner().catch((): ImportOutcome => ({
      status: 'error',
      error: "Couldn't import that. Check the files and try again.",
    }));
    if (outcome.status === 'done') {
      onDone(outcome);
      return;
    }
    if (outcome.status === 'error') setError(outcome.error);
    setBusy(false);
  };
  return { busy, error, setError, run };
}
