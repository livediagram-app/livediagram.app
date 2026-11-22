import { useRef, useState, type DragEvent } from 'react';
import { BackBar, Button, Spinner } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import {
  droppedArchive,
  inputFolderArchive,
  isZipFile,
  zipArchive,
  type PickedArchive,
} from '@/lib/knowledge-import/archive-sources';
import type { KnowledgeSource } from './sources';

// The first step of a Knowledgebase import (docs/specs/020-import-export/knowledgebase-import.md): a drop area
// naming what the source takes, Choose a .zip (and Choose a Folder where the source takes one), and how to get the
// file out of the other product. The same look as a Word import's file panel. Nothing is read here: the archive is
// handed on as it was picked.
export function ArchivePickStep({
  source,
  reading,
  error,
  onPick,
  onBack,
}: {
  source: KnowledgeSource;
  /** The picked archive is being read into a plan. */
  reading: string | null;
  error: string | null;
  /** Null when what was dropped holds nothing to read. */
  onPick: (archive: PickedArchive | null) => void;
  onBack: () => void;
}) {
  const zipInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = reading !== null;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (busy) return;
    // The drop's entries are read off the event now; walking a folder is the promise.
    void droppedArchive(e.dataTransfer).then(onPick, () => onPick(null));
  };

  return (
    <div className="flex min-h-[28rem] flex-col">
      <BackBar label="All Formats" current={source.title} onClick={onBack} disabled={busy} />
      <div
        role="region"
        aria-label={source.drop}
        aria-busy={busy}
        data-testid="knowledge-import-drop"
        data-over={over || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={onDrop}
        className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-short ${
          over
            ? 'border-brand-400 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
            : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40'
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {busy ? <Spinner size={22} /> : <source.Icon size={24} />}
        </span>
        <div aria-live="polite">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {busy ? (
              `Reading ${reading}…`
            ) : (
              <>
                {/* A touch screen has nothing to drag from: it names the choice instead. */}
                <span className="pointer-coarse:hidden">{source.drop}</span>
                <span className="hidden pointer-coarse:inline">{source.touch}</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {busy
              ? 'Nothing is imported yet. You will see what was found first.'
              : 'It is read on this device. You will see what was found before anything is imported.'}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" size="md" busy={busy} onClick={() => zipInput.current?.click()}>
            Choose a .zip
          </Button>
          {source.folder ? (
            // A phone's file picker chooses no folder.
            <Button
              variant="secondary"
              size="md"
              disabled={busy}
              className="pointer-coarse:hidden"
              onClick={() => folderInput.current?.click()}
            >
              Choose a Folder
            </Button>
          ) : null}
        </div>
        <input
          ref={zipInput}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          tabIndex={-1}
          aria-hidden
          data-testid="knowledge-import-zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // The same file chosen twice still fires a change.
            e.target.value = '';
            if (file) onPick(isZipFile(file) ? zipArchive(file) : null);
          }}
        />
        {source.folder ? (
          <input
            ref={folderInput}
            type="file"
            multiple
            className="hidden"
            tabIndex={-1}
            aria-hidden
            data-testid="knowledge-import-folder"
            // Not in React's types: the attribute that makes the picker choose a folder.
            {...{ webkitdirectory: '' }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length > 0) onPick(inputFolderArchive(files));
            }}
          />
        ) : null}
      </div>
      {error ? (
        <Callout tone="error" role="alert" className="mt-3">
          {error}
        </Callout>
      ) : null}
      <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">{source.hint}</p>
    </div>
  );
}
