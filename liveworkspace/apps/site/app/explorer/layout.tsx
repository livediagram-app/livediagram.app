import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ExplorerShell } from '@/components/explorer/ExplorerShell';
import { SilentSignInScript } from '@/components/explorer/SilentSignInScript';
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

// On an app's own address, the app's silent sign-in, before anything renders (lib/explorer/silent.ts). Outside the
// Suspense boundary, whose content the static export leaves to the browser, so the script is in every Explorer
// page's HTML and runs as the page loads.
const SILENT_SIGN_IN = explorerSilentSignInScript();

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {SILENT_SIGN_IN ? <SilentSignInScript source={SILENT_SIGN_IN} /> : null}
      <Suspense fallback={null}>
        <ExplorerShell />
        {children}
      </Suspense>
    </>
  );
}
