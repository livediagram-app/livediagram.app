'use client';

// Shape Libraries (livediagram's ShapeLibrariesPane): the person's libraries, newest first, each a card to rename,
// delete, or open to delete single shapes. One read on arrival from the host's store. A shape is drawn by the host's
// `renderShape` (drawing one takes the app's editor); without it each shows a plain tile of its proportions. Placed
// shapes are ordinary elements, so nothing here touches an item.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '@liveworkspace/ui';
import { ShapesIcon } from '../ui/library-icons';
import { isAbort } from '../data/errors';
import { PlainShapeTile } from './ShapePreview';
import type { LibraryShape, ShapeLibrariesHost, ShapeLibrary } from './types';

/** How many shapes a closed card shows. */
export const SHAPE_LIBRARY_CARD_PREVIEWS = 8;
const NAME_MAX = 120;

const titleOf = (shape: LibraryShape, index: number) => shape.title.trim() || `Shape ${index + 1}`;
const plural = (n: number) => `${n.toLocaleString('en-GB')} ${n === 1 ? 'shape' : 'shapes'}`;

const BUTTON =
  'rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-300';

type Loaded =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; libraries: ShapeLibrary[] };

export function ShapeLibrariesPane({
  host,
  compact = false,
  emptyAction,
}: {
  host: ShapeLibrariesHost;
  compact?: boolean;
  /** Under the empty state: the way to bring a library in (Import from draw.io). */
  emptyAction?: ReactNode;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    host.list(controller.signal).then(
      (libraries) => !controller.signal.aborted && setLoaded({ status: 'ready', libraries }),
      (e: unknown) => {
        if (!isAbort(e)) setLoaded({ status: 'failed' });
      },
    );
    return () => controller.abort();
  }, [host, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const replace = (id: string, next: ShapeLibrary | null) =>
    setLoaded((l) =>
      l.status === 'ready'
        ? {
            ...l,
            libraries: next
              ? l.libraries.map((x) => (x.id === id ? next : x))
              : l.libraries.filter((x) => x.id !== id),
          }
        : l,
    );
  // Optimistic: the card changes at once, and a refusal re-reads the list and says so.
  const change = (id: string, next: ShapeLibrary | null, run: () => Promise<void>) => {
    setError(null);
    replace(id, next);
    run().catch(() => {
      setError('That change didn’t save. Your libraries are as they were.');
      reload();
    });
  };

  if (loaded.status === 'loading') {
    return (
      <div role="status" aria-label="Loading shape libraries" className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-slate-200 bg-slate-50 motion-safe:animate-pulse dark:border-slate-700 dark:bg-slate-900/40"
          />
        ))}
      </div>
    );
  }
  if (loaded.status === 'failed') {
    return (
      <div className="px-1 py-8 text-sm text-slate-600 dark:text-slate-300">
        <p>Couldn’t load your shape libraries.</p>
        <button type="button" onClick={reload} className={`mt-2 ${BUTTON}`}>
          Try again
        </button>
      </div>
    );
  }
  if (loaded.libraries.length === 0) {
    return (
      <EmptyState
        compact={compact}
        icon={<ShapesIcon size={28} />}
        title="No shape libraries yet"
        description="Import a draw.io library and its shapes collect here."
      >
        {emptyAction}
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-explorer-shape-libraries="">
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
      {loaded.libraries.map((library) => (
        <LibraryCard
          key={library.id}
          library={library}
          host={host}
          compact={compact}
          onRenamed={(name) => replace(library.id, { ...library, name })}
          onDelete={() => change(library.id, null, () => host.remove(library))}
          onDeleteShape={(shape) =>
            change(
              library.id,
              { ...library, items: library.items.filter((s) => s.id !== shape.id) },
              () => host.removeShape(library, shape),
            )
          }
        />
      ))}
    </div>
  );
}

function LibraryCard({
  library,
  host,
  compact,
  onRenamed,
  onDelete,
  onDeleteShape,
}: {
  library: ShapeLibrary;
  host: ShapeLibrariesHost;
  compact: boolean;
  onRenamed: (name: string) => void;
  onDelete: () => void;
  onDeleteShape: (shape: LibraryShape) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const headingId = `shape-library-${library.id}`;
  return (
    <article
      aria-labelledby={headingId}
      data-shape-library={library.id}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <RenameInput
            library={library}
            max={host.nameMax ?? NAME_MAX}
            onRename={async (name) => {
              const done = await host.rename(library, name);
              if (done.ok) onRenamed(name);
              return done;
            }}
            onDone={() => setRenaming(false)}
          />
        ) : null}
        <h3
          id={headingId}
          className={`min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100 ${renaming ? 'sr-only' : ''}`}
        >
          {library.name}
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {plural(library.items.length)}
        </span>
      </div>
      {library.items.length > 0 ? (
        <ul className="mt-2 flex gap-2 overflow-hidden" aria-hidden>
          {library.items.slice(0, SHAPE_LIBRARY_CARD_PREVIEWS).map((shape) => (
            <li key={shape.id} data-testid="library-preview">
              <ShapeTile
                shape={shape}
                render={host.renderShape}
                className="h-10 w-14 rounded bg-white ring-1 ring-slate-200 dark:ring-slate-700"
              />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          aria-label={`Rename ${library.name}`}
          onClick={() => setRenaming(true)}
          className={BUTTON}
        >
          Rename
        </button>
        <button
          type="button"
          aria-label={`Delete ${library.name}`}
          onClick={() => setConfirming(true)}
          className={BUTTON}
        >
          Delete
        </button>
        {library.items.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={BUTTON}
          >
            {open ? 'Hide shapes' : 'Show shapes'}
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          aria-label={`Shapes in ${library.name}`}
          className={`mt-3 grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'}`}
        >
          {library.items.map((shape, i) => (
            <li
              key={shape.id}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-100 p-2 dark:border-slate-800"
            >
              <ShapeTile
                shape={shape}
                render={host.renderShape}
                className="h-12 w-full rounded bg-white ring-1 ring-slate-200 dark:ring-slate-700"
              />
              <span className="w-full truncate text-center text-xs text-slate-600 dark:text-slate-300">
                {titleOf(shape, i)}
              </span>
              <button
                type="button"
                aria-label={`Delete ${titleOf(shape, i)}`}
                onClick={() => onDeleteShape(shape)}
                className={BUTTON}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title="Delete This Shape Library?"
          message="Its shapes leave My shapes; anything that uses them keeps them."
          confirmLabel="Delete"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
        />
      ) : null}
    </article>
  );
}

/** A shape drawn small by the host, or a plain tile in its proportions. */
function ShapeTile({
  shape,
  render,
  className,
}: {
  shape: LibraryShape;
  render?: (shape: LibraryShape) => ReactNode;
  className: string;
}) {
  return (
    <span className={`flex items-center justify-center overflow-hidden ${className}`}>
      {render ? render(shape) : <PlainShapeTile shape={shape} />}
    </span>
  );
}

// The name in place: Enter saves (an empty or unchanged name saves nothing), Escape or leaving the field cancels; a
// refused name keeps the field open with its reason.
function RenameInput({
  library,
  max,
  onRename,
  onDone,
}: {
  library: ShapeLibrary;
  max: number;
  onRename: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDone: () => void;
}) {
  const [name, setName] = useState(library.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const next = name.trim();
    if (!next || next === library.name) return onDone();
    setSaving(true);
    const done = await onRename(next).catch(() => ({
      ok: false as const,
      error: 'That name didn’t save. Try again.',
    }));
    setSaving(false);
    if (done.ok) onDone();
    else setError(done.error);
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <input
        aria-label="Library name"
        autoFocus
        value={name}
        maxLength={max}
        disabled={saving}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') onDone();
        }}
        onBlur={() => {
          if (!saving && !error) onDone();
        }}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
