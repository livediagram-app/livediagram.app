'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { explorerUrl } from '@liveworkspace/sites';
import { ShapeLibraryProvider } from '@/components/primitives/ShapeLibraryProvider';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useGuestId } from '@/hooks/persistence/useGuestId';
import { replaceAppLocation } from '@/lib/app-location';
import { useExplorerImport } from '../explorer/useExplorerImport';
import { importReturnUrl, importRequestOf, type ImportRequest } from './import-request';

// The liveworkspace Explorer's "Import from" (docs/specs/013-workspace/folders.md "Import from"): reading another
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
    if (!request) replaceAppLocation(explorerUrl('livediagram'));
  }, [request]);
  if (!request || !ownerId) return null;
  return (
    <ShapeLibraryProvider ownerId={ownerId}>
      <OpenImport ownerId={ownerId} request={request} />
    </ShapeLibraryProvider>
  );
}

function OpenImport({ ownerId, request }: { ownerId: string; request: ImportRequest }) {
  const { open, dialogs } = useExplorerImport({
    ownerId,
    folderId: request.folderId,
    onDocumentsCreated: () => {},
  });
  // Set alongside the dialog's own open state, so the render after opening already shows it.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (opened) return;
    if (open(request.source)) setOpened(true);
    else replaceAppLocation(importReturnUrl(request));
  }, [opened, open, request]);
  useEffect(() => {
    if (opened && !dialogs) replaceAppLocation(importReturnUrl(request));
  }, [opened, dialogs, request]);
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950" aria-label="Import">
      {dialogs}
    </main>
  );
}
