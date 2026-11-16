import type { ReactNode } from 'react';
import { EDITOR_VIEWPORT } from './page-viewport';

// Each editor's /new route layout (re-exported as app/new/layout.tsx): /new opens the editor in place once its item is
// made, so the page is pinned at 1 like the editor's own route (lib/page-viewport.ts). The page itself is a client
// component, which can't export a viewport.
export const viewport = EDITOR_VIEWPORT;

export default function NewLayout({ children }: { children: ReactNode }) {
  return children;
}
