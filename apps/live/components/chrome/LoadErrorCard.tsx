'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { useOnline } from '@/hooks/ui/useOnline';
import { ApiErrorPage } from './ApiErrorPage';

// The recovery tools are a lazy chunk, fetched only when this card shows online. This card itself is
// in the editor's bundle: a load that failed because the connection dropped could not fetch a chunk
// any more, and the offline copy is the whole point then.
const LoadRecoveryCard = dynamic(
  () => import('./LoadRecoveryCard').then((m) => m.LoadRecoveryCard),
  {
    ssr: false,
  },
);

// The editor's load-error card (docs/specs/007-editor/load-recovery.md): Retry, then the recovery card
// for the full app. Offline it says so, and reloads by itself once the connection is back ("Offline");
// a card first shown online never reloads itself, since nothing tells it the cause has passed.

const LOAD_ERROR_MESSAGE =
  'We couldn’t load this document: it didn’t finish loading. Check your connection and try again.';

const reloadPage = () => window.location.reload();

export function LoadErrorCard({
  embed,
  ownerId,
  reload = reloadPage,
}: {
  embed: boolean;
  ownerId: string | null;
  reload?: () => void;
}) {
  const online = useOnline();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      reload();
    }
  }, [online, reload]);

  return (
    <ApiErrorPage
      onRetry={reload}
      {...(online
        ? { message: LOAD_ERROR_MESSAGE }
        : {
            eyebrow: 'Offline',
            title: 'You’re offline',
            message: 'This document will open as soon as you reconnect.',
          })}
    >
      {/* The recovery card is for the full app only (an embed's visitor is on someone else's page,
          where repairing their browser is not the fix), and only online: offline its chunk may be
          unreachable, and reconnecting reloads the page anyway. */}
      {embed || !online ? null : <LoadRecoveryCard ownerId={ownerId} />}
    </ApiErrorPage>
  );
}
