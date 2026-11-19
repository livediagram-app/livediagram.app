// The update panel (docs/specs/020-import-export/infrastructure-import.md "Updating a tab from its files"): the files
// the tab remembers, each Kept, Replaced, Needed or Removed, a new version chosen, pasted or dropped on the panel,
// files added, the environment, and Update Diagram, which reads them again over the tab as people left it.

import { useMemo, useState, type ReactNode } from 'react';
import { BackBar, Button, lucideGlyph } from '@livediagram/ui';
import { lucidePlus } from '@liveworkspace/icons/lucide';
import type { DiagramSources } from '@livediagram/document';
import type { InfraFile } from '@livediagram/document/infra-code';
import type { ImportOutcome } from '@/lib/import-tab';
import {
  entriesFromSources,
  entriesToFiles,
  matchDropped,
  replaceEntry,
  toggleRemoved,
  updateBlocked,
  type InfraEntry,
} from '@/lib/infra-files';
import { InfraEnvSelect } from './InfraEnvSelect';
import { InfraFileRow } from './InfraFileRow';
import {
  chooseInfraFile,
  chooseInfraFiles,
  readDroppedInfraFiles,
  useInfraRun,
} from './infra-panel-io';
import { envsOf, useInfraCode, useInfraFacts } from './useInfraFacts';
import { Callout } from '@liveworkspace/ui/callout';

const AddGlyph = lucideGlyph(lucidePlus, 14);

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

export function InfraUpdatePanel({
  sources,
  note,
  onUpdate,
  onDone,
  onBack,
}: {
  sources: DiagramSources;
  note?: ReactNode;
  onUpdate: (files: InfraFile[], env?: string) => Promise<ImportOutcome>;
  onDone: (outcome: DoneOutcome) => void;
  onBack: () => void;
}) {
  const [entries, setEntries] = useState<InfraEntry[]>(() => entriesFromSources(sources));
  const [env, setEnv] = useState(sources.env ?? '');
  const [over, setOver] = useState(false);
  const { busy, error, setError, run } = useInfraRun(onDone);
  const code = useInfraCode();
  const factInputs = useMemo(
    () =>
      entries
        .filter((e) => e.state !== 'removed')
        .map((e) => ({ key: e.id, name: e.name, text: e.text, format: e.format })),
    [entries],
  );
  const facts = useInfraFacts(code, factInputs);
  const envs = envsOf(facts);
  // The remembered environment stays offered while the files are still loading their facts.
  const offered = env && !envs.includes(env) && !code ? [...envs, env] : envs;
  const chosenEnv = offered.includes(env) ? env : '';
  // A replacement that reads the same as the remembered text says "No changes".
  const unchanged = useMemo(() => {
    const same = new Set<string>();
    if (!code) return same;
    for (const e of entries)
      if (e.state === 'replaced' && e.text !== undefined && e.hash === code.fingerprint(e.text))
        same.add(e.id);
    return same;
  }, [code, entries]);

  const change = (id: string, next: (e: InfraEntry) => InfraEntry) =>
    setEntries((es) => es.map((e) => (e.id === id ? next(e) : e)));
  const add = (read: { files: { name: string; text: string }[]; refused: string[] } | null) => {
    if (!read) return;
    setError(read.refused.length > 0 ? read.refused.join(' ') : null);
    if (read.files.length > 0) setEntries((es) => matchDropped(es, read.files));
  };
  const blocked = updateBlocked(entries);
  const needed = entries.some((e) => e.state === 'needed');

  return (
    <div>
      <BackBar label="All Formats" current="From Its Files" onClick={onBack} disabled={busy} />
      <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        Reads the files again into this tab. Boxes stay where they are with their style and any
        label you changed; what the files add is placed beside its neighbours, and what they no
        longer name is removed. Undo takes the update back.
      </p>
      <div
        data-testid="infra-update-drop"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (busy) return;
          void readDroppedInfraFiles(e.dataTransfer).then(add);
        }}
        className={`rounded-lg border transition ${over ? 'border-brand-400 bg-brand-50/40 ring-2 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30' : 'border-slate-200 dark:border-slate-700'}`}
      >
        <ul
          aria-label="The tab's files"
          className="divide-y divide-slate-200 dark:divide-slate-700"
        >
          {entries.map((e) => (
            <InfraFileRow
              key={e.id}
              entry={e}
              format={facts.get(e.id)?.format ?? e.format}
              unchanged={unchanged.has(e.id)}
              showState
              disabled={busy}
              onChoose={() =>
                void chooseInfraFile().then((read) => {
                  if (!read) return;
                  setError(read.refused.length > 0 ? read.refused.join(' ') : null);
                  const picked = read.files[0];
                  if (picked) change(e.id, (x) => replaceEntry(x, picked.text));
                })
              }
              onPaste={(text) => change(e.id, (x) => replaceEntry(x, text))}
              onRemove={() =>
                e.state === 'new'
                  ? setEntries((es) => es.filter((x) => x.id !== e.id))
                  : change(e.id, toggleRemoved)
              }
            />
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-slate-200 px-3 py-2 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Drop new versions here: each replaces the file of the same name.
          </span>
          <Button
            variant="ghost"
            size="xs"
            disabled={busy}
            onClick={() => void chooseInfraFiles().then(add)}
          >
            <AddGlyph />
            Add Files
          </Button>
        </div>
      </div>
      <InfraEnvSelect envs={offered} value={chosenEnv} onChange={setEnv} disabled={busy} />
      {error ? (
        <Callout tone="error" role="alert" className="mt-3">
          {error}
        </Callout>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0" aria-live="polite">
          {needed ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Choose or remove each file marked Needed first.
            </p>
          ) : (
            note
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          className="min-w-[8.5rem] shrink-0"
          disabled={blocked}
          busy={busy}
          onClick={() => void run(() => onUpdate(entriesToFiles(entries), chosenEnv || undefined))}
        >
          {busy ? 'Updating…' : 'Update Diagram'}
        </Button>
      </div>
    </div>
  );
}
