import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ExplorerShell } from '@/components/explorer/ExplorerShell';
import { explorerSilentSignInScript } from '@/lib/explorer/silent';
import './explorer.css';

// The Explorer (liveworkspace/docs/site.md "The Explorer"): every view is its own route page under /explorer, and
// this layout keeps the one Explorer mounted across them, so a list already loaded stays loaded. Suspense: the view
// is read from the address with useSearchParams, which a static export requires to sit under a boundary. Private
// to the person, so never indexed.
export const metadata: Metadata = {
  title: 'Explorer · liveworkspace',
  description: 'Everything you make in the liveworkspace apps, in one place.',
  robots: { index: false, follow: false },
};

// On an app's own address, the app's silent sign-in, before anything renders (lib/explorer/silent.ts).
const SILENT_SIGN_IN = explorerSilentSignInScript();

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      {SILENT_SIGN_IN ? <script dangerouslySetInnerHTML={{ __html: SILENT_SIGN_IN }} /> : null}
      <ExplorerShell />
      {children}
    </Suspense>
  );
}
