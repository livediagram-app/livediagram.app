'use client';

import { useState } from 'react';
import { EmptyState, lucideGlyph } from '@livediagram/ui';
import { lucideShapes } from '@livediagram/icons/lucide';
import {
  MAX_SHAPE_LIBRARY_NAME_CHARS,
  type ShapeLibrary,
  type ShapeLibraryItem,
} from '@livediagram/api-schema';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import { LibraryItemThumbnail } from '@/components/primitives/LibraryItemThumbnail';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// The Explorer's Shape libraries page (docs/specs/013-workspace/shape-libraries.md "Managing
// libraries: the Explorer"): the owner's libraries, newest first, each a card to rename, delete, or
// open to delete single shapes. Reads the shared list the Explorer shell provides; placed shapes are
// ordinary elements, so nothing here touches a document.

/** How many thumbnails a closed card shows (spec: "the first eight"). */
export const SHAPE_LIBRARY_CARD_PREVIEWS = 8;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
const titleOf = (item: ShapeLibraryItem, index: number) =>
  item.title.trim() || `Shape ${index + 1}`;

const ShapesBadge = lucideGlyph(lucideShapes, 28);

const BUTTON =
  'rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-300';

export function ShapeLibrariesPane() {
  const { libraries, status, reload } = useShapeLibraries();
  if (status === 'loading') {
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
  if (status === 'error') {
    return (
      <div className="px-1 py-8 text-sm text-slate-600 dark:text-slate-300">
        <p>Couldn&apos;t load your shape libraries.</p>
        <button type="button" onClick={() => void reload()} className={`mt-2 ${BUTTON}`}>
          Try again
        </button>
      </div>
    );
  }
  if (libraries.length === 0) {
    return (
      <EmptyState
        icon={<ShapesBadge />}
        title="No shape libraries yet"
        description="Import a draw.io library with Import from draw.io."
      >
        <HelpArticleLink article="shapeLibraries" variant="text" />
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <HelpArticleLink article="shapeLibraries" variant="text" />
      </div>
      {libraries.map((library) => (
        <LibraryCard key={library.id} library={library} />
      ))}
    </div>
  );
}

function LibraryCard({ library }: { library: ShapeLibrary }) {
  const { renameLibrary, deleteLibrary, deleteItem } = useShapeLibraries();
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState(false);
  const [open, setOpen] = useState(false);
  const headingId = `shape-library-${library.id}`;

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this shape library?',
      message: 'Its shapes leave My shapes; documents that use them keep them.',
      confirmLabel: 'Delete',
    });
    if (ok) await deleteLibrary(library.id);
  };

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <RenameInput
            library={library}
            onRename={(name) => renameLibrary(library.id, name)}
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
          {plural(library.items.length, 'shape', 'shapes')}
        </span>
      </div>
      {library.items.length > 0 ? (
        <ul className="mt-2 flex gap-2 overflow-hidden" aria-hidden>
          {library.items.slice(0, SHAPE_LIBRARY_CARD_PREVIEWS).map((item) => (
            <li key={item.id} data-testid="library-preview">
              <LibraryItemThumbnail
                item={item}
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
          onClick={() => void remove()}
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
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6"
        >
          {library.items.map((item, i) => (
            <li
              key={item.id}
              className="flex flex-col items-center gap-1 rounded-lg border border-slate-100 p-2 dark:border-slate-800"
            >
              <LibraryItemThumbnail
                item={item}
                className="h-12 w-full rounded bg-white ring-1 ring-slate-200 dark:ring-slate-700"
              />
              <span className="w-full truncate text-center text-xs text-slate-600 dark:text-slate-300">
                {titleOf(item, i)}
              </span>
              <button
                type="button"
                aria-label={`Delete ${titleOf(item, i)}`}
                onClick={() => void deleteItem(library.id, item.id)}
                className={BUTTON}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

// The name in place: Enter saves (an empty or unchanged name saves nothing), Escape or leaving the
// field cancels; a refused name keeps the field open with its reason.
function RenameInput({
  library,
  onRename,
  onDone,
}: {
  library: ShapeLibrary;
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
    const done = await onRename(next);
    setSaving(false);
    if (done.ok) onDone();
    else setError(done.error);
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <input
        aria-label="Library name"
        // The field opens for typing at once.
        autoFocus
        value={name}
        maxLength={MAX_SHAPE_LIBRARY_NAME_CHARS}
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
