// The Infrastructure card's panel (docs/specs/020-import-export/infrastructure-import.md "The editor"): several files
// dropped or chosen at once, each a row, a paste box for one more, the Wrangler environment when a file has one, and
// Import. The parsers load as it opens, to read each file's format and environments.

import { useMemo, useState, type ReactNode } from 'react';
import { BackBar, Button } from '@livediagram/ui';
import { FileTypes } from '@liveworkspace/workbench/components/dialogs/FormatCard';
import type { InfraFile } from '@livediagram/document/infra-code';
import type { ImportOutcome } from '@/lib/import-tab';
import { entriesToFiles, newEntries, type InfraEntry } from '@/lib/infra-files';
import { ImportDropZone } from '../ImportDropZone';
import { InfraEnvSelect } from './InfraEnvSelect';
import { InfraFileRow } from './InfraFileRow';
import { chooseInfraFiles, readDroppedInfraFiles, useInfraRun } from './infra-panel-io';
import { envsOf, useInfraCode, useInfraFacts, useSettled } from './useInfraFacts';

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

export const INFRA_PASTE_PLACEHOLDER =
  'services:\n  web:\n    image: nginx\n    depends_on: [api]\n  api:\n    build: .\n\n# or a wrangler.toml, a .tf file or a Kubernetes manifest';

export function InfraImportPanel({
  note,
  fileTypes,
  onImport,
  onDone,
  onBack,
}: {
  note?: ReactNode;
  // The file endings the drop target takes (FileTypes), under it as on the other formats' panels.
  fileTypes?: readonly string[];
  onImport: (files: InfraFile[], env?: string) => Promise<ImportOutcome>;
  onDone: (outcome: DoneOutcome) => void;
  onBack?: () => void;
}) {
  const [entries, setEntries] = useState<InfraEntry[]>([]);
  const [paste, setPaste] = useState('');
  const [env, setEnv] = useState('');
  const { busy, error, setError, run } = useInfraRun(onDone);
  const code = useInfraCode();
  const settledPaste = useSettled(paste, 250);
  const factInputs = useMemo(
    () => [
      ...entries.map((e) => ({ key: e.id, name: e.name, text: e.text })),
      ...(settledPaste.trim() ? [{ key: 'paste', name: '', text: settledPaste }] : []),
    ],
    [entries, settledPaste],
  );
  const facts = useInfraFacts(code, factInputs);
  const envs = envsOf(facts);
  // A file taken out takes its environments with it: the choice falls back to the top level.
  const chosenEnv = envs.includes(env) ? env : '';

  const add = (files: { name: string; text: string }[], refused: string[]) => {
    setError(refused.length > 0 ? refused.join(' ') : null);
    if (files.length === 0) return;
    setEntries((es) => {
      // The same file twice is one row.
      const fresh = files.filter((f) => !es.some((e) => e.name === f.name && e.text === f.text));
      return [...es, ...newEntries(fresh)];
    });
  };

  const files = (): InfraFile[] => [
    ...entriesToFiles(entries),
    ...(paste.trim() ? [{ text: paste }] : []),
  ];
  const empty = entries.length === 0 && paste.trim().length === 0;

  return (
    <div>
      {onBack ? (
        <BackBar label="All Formats" current="Infrastructure" onClick={onBack} disabled={busy} />
      ) : null}
      <ImportDropZone
        label="Drop wrangler.toml, Compose, Terraform or Kubernetes files here, or choose them"
        onChoose={() => {
          if (busy) return;
          void chooseInfraFiles().then((picked) => picked && add(picked.files, picked.refused));
        }}
        onDropData={(data) => {
          if (busy) return;
          void readDroppedInfraFiles(data).then(({ files: read, refused }) => add(read, refused));
        }}
      />
      {fileTypes?.length ? <FileTypes types={fileTypes} className="mt-2" /> : null}
      {entries.length > 0 ? (
        <ul
          aria-label="Files to import"
          className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700"
        >
          {entries.map((e) => (
            <InfraFileRow
              key={e.id}
              entry={e}
              format={facts.get(e.id)?.format}
              showState={false}
              disabled={busy}
              onRemove={() => setEntries((es) => es.filter((x) => x.id !== e.id))}
            />
          ))}
        </ul>
      ) : null}
      <label className="mt-4 block text-xs font-medium text-slate-700 dark:text-slate-200">
        {entries.length > 0 ? 'Paste one more file' : 'Or paste a file'}
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          spellCheck={false}
          placeholder={INFRA_PASTE_PLACEHOLDER}
          disabled={busy}
          className="mt-1.5 block h-32 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs leading-relaxed font-normal text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:ring-brand-500/30"
        />
      </label>
      <InfraEnvSelect envs={envs} value={chosenEnv} onChange={setEnv} disabled={busy} />
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">{note}</div>
        <Button
          variant="primary"
          size="md"
          // Wide enough for "Importing…", so the label swap moves nothing.
          className="min-w-[7.5rem]"
          disabled={empty}
          busy={busy}
          onClick={() => void run(() => onImport(files(), chosenEnv || undefined))}
        >
          {busy ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </div>
  );
}
