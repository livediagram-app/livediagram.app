'use client';

// The first step of an import from another tool (docs/specs/026-plan/tracker-import.md "Reading the file"): a file
// to choose (or drop), the four tools it may come from, and where each keeps its export.
import { useState, type DragEvent } from 'react';
import { ChevronDownIcon } from '@liveplanner/ui';
import { ChooseFileIcon } from './tracker-icons';

const SOURCES = [
  {
    name: 'Trello',
    file: 'JSON',
    where: 'The board’s Menu, Print, export and share, Export as JSON.',
  },
  { name: 'Asana', file: 'CSV', where: 'The project’s name menu, Export/Print, CSV.' },
  { name: 'Jira', file: 'CSV', where: 'Issue search, Export, Export CSV (all fields).' },
  { name: 'Linear', file: 'CSV', where: 'Settings, Import / Export, Export CSV.' },
] as const;

export function TrackerChooseView({
  reading,
  onChoose,
  onDropFile,
}: {
  reading: boolean;
  onChoose: () => void;
  onDropFile: (file: File) => void;
}) {
  const [over, setOver] = useState(false);
  const dragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setOver(true);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file && !reading) onDropFile(file);
  };
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onChoose}
        disabled={reading}
        onDragOver={dragOver}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        aria-busy={reading}
        className={`group flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-9 text-center transition focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-wait ${
          over
            ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500/70 dark:bg-brand-500/10'
            : 'border-slate-200 bg-slate-50/60 enabled:hover:border-brand-300 enabled:hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900/40 dark:enabled:hover:border-brand-500/60'
        }`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-brand-300 dark:ring-slate-700">
          <ChooseFileIcon />
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {reading ? 'Reading the File…' : 'Choose a File'}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {reading
            ? 'Working out what it will make.'
            : 'or drop it here. Up to 20 MB and 2,000 cards.'}
        </span>
      </button>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Exports it reads">
        {SOURCES.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[12px] dark:border-slate-700"
          >
            <span className="font-semibold text-slate-700 dark:text-slate-200">{s.name}</span>
            <span className="text-slate-400 dark:text-slate-400">{s.file}</span>
          </li>
        ))}
      </ul>
      <details className="group rounded-lg border border-slate-200 text-[12px] dark:border-slate-700">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-medium text-slate-600 select-none group-open:border-b group-open:border-slate-200 hover:text-slate-900 dark:text-slate-300 dark:group-open:border-slate-700 dark:hover:text-slate-50 [&::-webkit-details-marker]:hidden">
          Where to Find the Export
          <span aria-hidden className="transition-transform group-open:rotate-180">
            <ChevronDownIcon />
          </span>
        </summary>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-3 py-2.5 text-slate-600 dark:text-slate-300">
          {SOURCES.map((s) => (
            <div key={s.name} className="contents">
              <dt className="font-semibold text-slate-700 dark:text-slate-200">{s.name}</dt>
              <dd>{s.where}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
        A one-off copy: nothing links back to the other tool. Comments come into an Imported
        comments thread on each card, attachments as links in its description.
      </p>
    </div>
  );
}
