'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/telemetry';
import { OpenverseSearchError, type OpenverseImage } from '@/lib/image-search/openverse';
import { searchOpenverse } from '@/lib/image-search/search';
import { pickFailureMessage, storeSearchResult, type PickStage } from '@/lib/image-search/pick';
import type { PickedImage } from '@/lib/upload-image';
import {
  IMAGE_SEARCH_THUMBNAIL_FALLBACK,
  pickWarningType,
  searchWarningType,
} from '@/lib/image-search/telemetry';

// State of the image picker's Search tab (docs/specs/009-elements/blueprints/image-search.md
// "Behaviour and state"): the submitted query, the pages loaded so far, the
// search status, and the one pick in flight.

export type ImageSearchStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ImageSearchError = OpenverseSearchError['kind'];

export function useImageSearch({
  ownerId,
  documentId,
  onPicked,
}: {
  ownerId: string;
  documentId: string;
  onPicked: (image: PickedImage) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenverseImage[]>([]);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [status, setStatus] = useState<ImageSearchStatus>('idle');
  // The query being searched for (shown while it loads) and whether the load is a further page.
  const [pending, setPending] = useState<{ query: string; more: boolean }>({
    query: '',
    more: false,
  });
  const [error, setError] = useState<ImageSearchError | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [pickStage, setPickStage] = useState<PickStage>('downloading');
  const [pickError, setPickError] = useState<string | null>(null);
  // The latest request's number: an older answer arriving late is dropped.
  const seq = useRef(0);
  // A pick that finishes after the picker closed is ignored.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (q: string, nextPage: number) => {
    const mine = ++seq.current;
    setPending({ query: q, more: nextPage > 1 });
    setStatus('loading');
    setError(null);
    setPickError(null);
    try {
      const answer = await searchOpenverse(q, nextPage);
      if (mine !== seq.current || !mounted.current) return;
      setQuery(q);
      setPage(answer.page);
      setPageCount(answer.pageCount);
      setResults((prev) => {
        if (nextPage === 1) return answer.results;
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...answer.results.filter((r) => !seen.has(r.id))];
      });
      setStatus('ready');
    } catch (e) {
      if (mine !== seq.current || !mounted.current) return;
      const kind = e instanceof OpenverseSearchError ? e.kind : 'failed';
      console.warn(
        '[image-search] search failed',
        `kind=${kind}`,
        `status=${e instanceof OpenverseSearchError ? (e.status ?? 0) : 0}`,
      );
      track('Error', 'Warning', searchWarningType(kind));
      setError(kind);
      setStatus('error');
    }
  }, []);

  const submit = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      track('Element', 'Searched', 'Image');
      void load(q, 1);
    },
    [load],
  );

  const loadMore = useCallback(() => {
    if (status !== 'ready' || page >= pageCount) return;
    void load(query, page + 1);
  }, [load, page, pageCount, query, status]);

  const pick = useCallback(
    async (result: OpenverseImage) => {
      if (pickingId) return;
      setPickingId(result.id);
      setPickStage('downloading');
      setPickError(null);
      let outcome: Awaited<ReturnType<typeof storeSearchResult>>;
      try {
        // The pipeline's browser half is DOM-heavy; load it on first pick.
        const { createBrowserImportImageSession } = await import('@/lib/import-images/browser');
        const session = createBrowserImportImageSession({ ownerId, documentId });
        outcome = await storeSearchResult(
          result,
          (source) => session.store(source),
          fetch,
          () => track('Error', 'Warning', IMAGE_SEARCH_THUMBNAIL_FALLBACK),
          (stage) => {
            if (mounted.current) setPickStage(stage);
          },
        );
      } catch {
        // A failed chunk load or an unexpected throw must not leave the grid locked.
        outcome = { ok: false, failure: 'download-failed' };
      }
      if (!mounted.current) return;
      setPickingId(null);
      if (outcome.ok) {
        onPicked(outcome.picked);
        return;
      }
      console.warn('[image-search] pick failed', `failure=${outcome.failure}`);
      track('Error', 'Warning', pickWarningType(outcome.failure));
      setPickError(pickFailureMessage(outcome.failure));
    },
    [documentId, onPicked, ownerId, pickingId],
  );

  return {
    query,
    pendingQuery: pending.query,
    loadingMore: status === 'loading' && pending.more,
    results,
    status,
    error,
    hasMore: status !== 'idle' && page < pageCount,
    pickingId,
    pickStage,
    pickError,
    submit,
    loadMore,
    pick: (result: OpenverseImage) => void pick(result),
  };
}
