'use client';

import { useSyncExternalStore } from 'react';
import { hasQuietLanding } from '@/lib/quiet-landing';
import { BlankCanvasScreen } from './BlankCanvasScreen';
import { DocumentLoading } from './DocumentLoading';

const subscribeNever = () => () => {};
const notPending = () => false;

// The editor's "opening" wait (docs/specs/007-editor/new-document-route.md), wherever it shows:
// the editor chunk loading after /new's handoff, and the document loading. Arriving from the
// hero's launch window (the quiet-landing flag set), it holds the quiet blank canvas the
// hero grew into; otherwise the opening screen. An external-store read whose server snapshot is
// false, so the prerendered /document placeholder hydrates to the usual opening screen.
export function OpeningScreen() {
  const quiet = useSyncExternalStore(subscribeNever, hasQuietLanding, notPending);
  return quiet ? <BlankCanvasScreen /> : <DocumentLoading stage="opening" />;
}
