'use client';

import dynamic from 'next/dynamic';
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';

// The Knowledgebase Home (docs/specs/030-knowledgebase/knowledgebase-home.md): the app's start for a signed-in
// person, here at the editor's root and at /home. Its code is fetched for the people who see it, never with a
// share link's redirect.
const HomeScreen = dynamic(() => import('@/components/home/HomeScreen').then((m) => m.HomeScreen), {
  ssr: false,
  loading: () => <OpeningScreen />,
});

// The editor's root. A visitor's `?s=<code>` address is forwarded to the editor, as it always was: that scheme
// stays a query param because the code is the lookup key, not a path id (the editor reads `?s=` under
// `/document/shared`). Everyone else gets Home, which sends someone not signed in on to `/new`
// (docs/specs/007-editor/new-document-route.md), where the start used to send everyone.
const never = () => () => {};
// The visitor's share code: null when the address has none, undefined before the browser is asked.
const shareCodeHere = () => new URL(window.location.href).searchParams.get('s');
const notKnown = () => undefined;

export default function LiveIndex() {
  const shareCode = useSyncExternalStore(never, shareCodeHere, notKnown);
  useLayoutEffect(() => {
    if (shareCode)
      window.location.replace(
        `${window.location.origin}/document/shared?s=${encodeURIComponent(shareCode)}`,
      );
  }, [shareCode]);
  return shareCode === null ? <HomeScreen /> : null;
}
