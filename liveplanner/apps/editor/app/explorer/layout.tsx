import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ExplorerRedirect } from './ExplorerRedirect';

// The Explorer moved to liveworkspace.app (lib/explorer-redirect.ts): each old /explorer address replaces itself
// with its place there. The pages stay so the dev server has something to serve at each address.
export const metadata: Metadata = {
  title: 'Explorer | liveplanner',
  robots: { index: false, follow: false },
};

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ExplorerRedirect />
      {children}
    </>
  );
}
