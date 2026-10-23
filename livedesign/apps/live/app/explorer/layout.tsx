import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ExplorerShell } from './ExplorerShell';

// The /explorer layout: every view of the shared Explorer (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md)
// is its own route page under /explorer, and this layout keeps the one Explorer mounted across them, so a list already
// loaded stays loaded. Suspense: the view is read from the URL with useSearchParams, which `output: 'export'` requires
// to sit under a boundary at prerender time.
export const metadata: Metadata = {
  title: 'Explorer | livedesign',
};

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ExplorerShell />
      {children}
    </Suspense>
  );
}
