'use client';

import { useState } from 'react';
import { Button, TextInput } from '@livediagram/ui';
import { useImageSearch } from '@/hooks/ui/useImageSearch';
import { licenceLabel, tileLabelFor, type OpenverseImage } from '@/lib/image-search/openverse';
import type { PickedImage } from '@/lib/upload-image';

// The image picker's Search tab (docs/specs/009-elements/image-search.md "The
// Search tab"): openly licensed pictures from Openverse, searched from the
// browser on submit, picked into the gallery through the import pipeline.

const SEARCH_ERROR_COPY = {
  'rate-limited': 'Too many searches for now. Wait a minute and try again.',
  failed: 'Couldn’t reach Openverse. Check your connection and try again.',
} as const;

const ERROR_BOX =
  'rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';

export function ImageSearchPane({
  ownerId,
  documentId,
  onPicked,
}: {
  ownerId: string;
  documentId: string;
  onPicked: (image: PickedImage) => void;
}) {
  const [draft, setDraft] = useState('');
  const search = useImageSearch({ ownerId, documentId, onPicked });
  const loading = search.status === 'loading';

  return (
    <div className="flex flex-col gap-3">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search.submit(draft);
        }}
      >
        <label htmlFor="image-search-query" className="sr-only">
          Search images
        </label>
        <TextInput
          id="image-search-query"
          type="search"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search openly licensed images"
          className="min-w-0 flex-1"
        />
        <Button type="submit" size="sm" disabled={loading}>
          Search
        </Button>
      </form>

      <div aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
        {search.status === 'idle' ? (
          <p>Find openly licensed photos and illustrations from Openverse.</p>
        ) : loading ? (
          <p>Searching…</p>
        ) : search.status === 'error' && search.error ? (
          <p className={ERROR_BOX}>{SEARCH_ERROR_COPY[search.error]}</p>
        ) : search.status === 'ready' && search.results.length === 0 ? (
          <p>No images match “{search.query}”. Try a broader word.</p>
        ) : null}
      </div>

      {search.results.length > 0 ? (
        <ul
          aria-busy={loading}
          className={`grid max-h-72 grid-cols-4 gap-2 overflow-y-auto transition-opacity ${
            loading ? 'opacity-50' : ''
          }`}
        >
          {search.results.map((result) => (
            <SearchTile
              key={result.id}
              result={result}
              picking={search.pickingId === result.id}
              disabled={search.pickingId !== null}
              onPick={() => search.pick(result)}
            />
          ))}
        </ul>
      ) : null}

      {search.pickError ? <p className={ERROR_BOX}>{search.pickError}</p> : null}

      {search.hasMore ? (
        <Button
          variant="secondary"
          size="xs"
          className="self-center"
          disabled={loading}
          onClick={search.loadMore}
        >
          Load more
        </Button>
      ) : null}

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Images from{' '}
        <a
          href="https://openverse.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-700 dark:hover:text-slate-200"
        >
          Openverse
        </a>
      </p>
    </div>
  );
}

function SearchTile({
  result,
  picking,
  disabled,
  onPick,
}: {
  result: OpenverseImage;
  picking: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const licence = licenceLabel(result.license, result.licenseVersion);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        aria-label={tileLabelFor(result)}
        className="group relative block aspect-square w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100 transition hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60"
      >
        <img
          src={result.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          className={`h-full w-full object-cover ${disabled && !picking ? 'opacity-60' : ''}`}
        />
        {result.creator || licence ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-slate-900/75 px-1.5 py-1 text-left text-[10px] leading-tight text-white group-hover:block group-focus-visible:block"
          >
            {result.creator ? <span className="block truncate">{result.creator}</span> : null}
            {licence ? <span className="block truncate opacity-80">{licence}</span> : null}
          </span>
        ) : null}
        {picking ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60">
            <span
              aria-hidden
              className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 dark:border-slate-600 dark:border-t-brand-400"
            />
            <span className="sr-only">Adding image…</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}
