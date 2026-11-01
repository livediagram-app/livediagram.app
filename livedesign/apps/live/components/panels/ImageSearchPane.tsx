'use client';

import { useState } from 'react';
import { Button, NoMatches, TextInput } from '@livedesign/ui';
import { useImageSearch } from '@/hooks/ui/useImageSearch';
import {
  licenceLabel,
  tileLabelFor,
  type OpenverseFilters,
  type OpenverseImage,
} from '@/lib/image-search/openverse';
import type { PickedImage } from '@/lib/upload-image';
import type { PickStage } from '@/lib/image-search/pick';
import {
  PlaceholderArt,
  PickOverlay,
  PickStatus,
  SearchingStatus,
  SKELETON_TILES_FIRST,
  SKELETON_TILES_MORE,
  SkeletonTiles,
  skeletonClass,
} from './ImageSearchLoader';

// The image picker's Search tab (docs/specs/009-elements/image-search.md "The
// Search tab"): openly licensed pictures from Openverse, searched from the
// browser on submit, picked into the gallery through the import pipeline. A page's Image
// background (docs/specs/007-editor/pages-mode.md "Image backgrounds") shows the same pane,
// narrower, asking for its page's shape and previewing a hovered result on the page.

const SEARCH_ERROR_COPY = {
  'rate-limited': 'Too many searches for now. Wait a minute and try again.',
  failed: 'Couldn’t reach Openverse. Check your connection and try again.',
} as const;

const ERROR_BOX =
  'rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';

// The grid's columns: four in the picker, three in a page's narrower Background.
const GRID_COLUMNS = { 3: 'grid-cols-3', 4: 'grid-cols-4' } as const;

export function ImageSearchPane({
  ownerId,
  designId,
  onPicked,
  filters,
  onPreview,
  columns = 4,
  autoFocus = true,
}: {
  ownerId: string;
  designId: string;
  onPicked: (image: PickedImage, result: OpenverseImage) => void;
  // Openverse's shape and size filters; the picker passes none.
  filters?: OpenverseFilters;
  // Told the result hovered or focused, and null once the pointer leaves the grid.
  onPreview?: (result: OpenverseImage | null) => void;
  columns?: keyof typeof GRID_COLUMNS;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const search = useImageSearch({ ownerId, designId, onPicked, filters });
  const grid = GRID_COLUMNS[columns];
  const loading = search.status === 'loading';
  // A new search swaps the grid for placeholders; a further page adds a row of them under it.
  const searching = loading && !search.loadingMore;
  const picking = search.pickingId !== null;

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
          autoFocus={autoFocus}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search openly licensed images"
          className="min-w-0 flex-1"
        />
        <Button type="submit" size="sm" busy={loading || picking}>
          Search
        </Button>
      </form>

      <div aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
        {search.status === 'idle' ? (
          <p>Find openly licensed photos and illustrations from Openverse.</p>
        ) : searching ? (
          <SearchingStatus query={search.pendingQuery} />
        ) : search.loadingMore ? (
          <p>Loading more…</p>
        ) : search.status === 'error' && search.error ? (
          <p className={ERROR_BOX}>{SEARCH_ERROR_COPY[search.error]}</p>
        ) : search.status === 'ready' && search.results.length === 0 ? (
          <NoMatches
            size="regular"
            things="images"
            query={search.query}
            hint="Try a broader word."
          />
        ) : null}
      </div>

      {searching ? (
        <ul aria-busy className={`grid max-h-72 ${grid} gap-2 overflow-hidden`}>
          <SkeletonTiles count={SKELETON_TILES_FIRST} />
        </ul>
      ) : search.results.length > 0 ? (
        <ul
          aria-busy={loading || picking}
          className={`grid max-h-72 ${grid} gap-2 overflow-y-auto p-0.5`}
          onPointerLeave={onPreview ? () => onPreview(null) : undefined}
        >
          {search.results.map((result, i) => (
            <SearchTile
              key={result.id}
              index={i}
              result={result}
              picking={search.pickingId === result.id}
              stage={search.pickStage}
              disabled={picking}
              onPick={() => search.pick(result)}
              onPreview={onPreview ? () => onPreview(result) : undefined}
            />
          ))}
          {search.loadingMore ? (
            <SkeletonTiles count={SKELETON_TILES_MORE} from={search.results.length} />
          ) : null}
        </ul>
      ) : null}

      {picking ? <PickStatus stage={search.pickStage} /> : null}

      {search.pickError ? <p className={ERROR_BOX}>{search.pickError}</p> : null}

      {search.hasMore && !searching ? (
        <Button
          variant="secondary"
          size="xs"
          className="self-center"
          busy={loading || picking}
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
  index,
  result,
  picking,
  stage,
  disabled,
  onPick,
  onPreview,
}: {
  index: number;
  result: OpenverseImage;
  picking: boolean;
  stage: PickStage;
  disabled: boolean;
  onPick: () => void;
  onPreview?: () => void;
}) {
  const licence = licenceLabel(result.license, result.licenseVersion);
  // Until its thumbnail arrives the tile is a placeholder photo, glinting like the search's own.
  const [loaded, setLoaded] = useState(false);
  // Openverse cannot render every thumbnail (a 424 for some large originals): the picture itself stands in, once.
  const [src, setSrc] = useState(result.thumbnail);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        onPointerEnter={onPreview}
        onFocus={onPreview}
        disabled={disabled}
        aria-label={tileLabelFor(result)}
        aria-busy={picking || undefined}
        className={`group relative block aspect-square w-full overflow-hidden rounded-md border transition ${
          loaded ? 'bg-slate-100 dark:bg-slate-800' : skeletonClass(index)
        } hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:border-brand-500/60 ${
          picking
            ? 'z-10 scale-[1.04] border-brand-500 shadow-lg shadow-brand-500/25 ring-2 ring-brand-400/60 dark:border-brand-400'
            : 'border-slate-200 disabled:cursor-not-allowed dark:border-slate-700'
        }`}
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (src !== result.url && result.url) setSrc(result.url);
            else setLoaded(true);
          }}
          className={`relative h-full w-full object-cover transition ${
            !loaded ? 'opacity-0' : disabled && !picking ? 'opacity-40 grayscale-[60%]' : ''
          }`}
        />
        {loaded ? null : <PlaceholderArt />}
        {(result.creator || licence) && !picking ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-slate-900/75 px-1.5 py-1 text-left text-[10px] leading-tight text-white group-hover:block group-focus-visible:block"
          >
            {result.creator ? <span className="block truncate">{result.creator}</span> : null}
            {licence ? <span className="block truncate opacity-80">{licence}</span> : null}
          </span>
        ) : null}
        {picking ? <PickOverlay stage={stage} /> : null}
      </button>
    </li>
  );
}
