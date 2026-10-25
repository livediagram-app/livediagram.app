'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShapeLibraryProvider } from '@/components/primitives/ShapeLibraryProvider';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useGuestId } from '@/hooks/persistence/useGuestId';
import { replaceAppLocation } from '@liveworkspace/workbench/lib/app-location';
import { explorerHref } from '@/lib/explorer-href';
import { useImportDialogs } from './useImportDialogs';
import { importReturnUrl, importRequestOf, type ImportRequest } from './import-request';

// The Explorer's "Import from" (docs/specs/013-workspace/folders.md "Import from"): reading another
// tool's files takes the editor's importers, so the Explorer sends people here with `?source=&what=&folder=`.
// The page opens that source's import at once and, when its dialog closes, returns to the Explorer where the
// imports landed: the folder for documents, Shape Libraries for libraries.
export default function ImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportFromSearch />
    </Suspense>
  );
}

function ImportFromSearch() {
  const params = useSearchParams().toString();
  const request = useMemo(() => importRequestOf(new URLSearchParams(params)), [params]);
  const { authLoaded, accountUserId } = useAccountBootstrap();
  const guestId = useGuestId(authLoaded, accountUserId);
  const ownerId = authLoaded ? (accountUserId ?? guestId) : null;
  useEffect(() => {
    if (!request) replaceAppLocation(explorerHref());
  }, [request]);
  if (!request || !ownerId) return null;
  return (
    <ShapeLibraryProvider ownerId={ownerId}>
      <OpenImport ownerId={ownerId} request={request} />
    </ShapeLibraryProvider>
  );
}

function OpenImport({ ownerId, request }: { ownerId: string; request: ImportRequest }) {
  const { open, dialogs } = useImportDialogs({
    ownerId,
    folderId: request.folderId,
    onDocumentsCreated: () => {},
  });
  // Asked once (an effect run twice in development must not open it twice); left once its dialog has shown and closed.
  const asked = useRef(false);
  const shown = useRef(false);
  useEffect(() => {
    if (dialogs) {
      shown.current = true;
      return;
    }
    if (shown.current) {
      replaceAppLocation(importReturnUrl(request));
      return;
    }
    if (asked.current) return;
    asked.current = true;
    if (!open(request.source)) replaceAppLocation(importReturnUrl(request));
  }, [dialogs, open, request]);
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950" aria-label="Import">
      {dialogs}
    </main>
  );
}
