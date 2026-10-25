import type { ReactNode } from 'react';
import { EDITOR_VIEWPORT } from '@liveworkspace/workbench/lib/page-viewport';

// /new opens the editor in place once its project is made, so the page is pinned at 1 like the editor's own
// route (lib/page-viewport.ts). The page itself is a client component, which can't export a viewport.
export const viewport = EDITOR_VIEWPORT;

export default function NewLayout({ children }: { children: ReactNode }) {
  return children;
}
