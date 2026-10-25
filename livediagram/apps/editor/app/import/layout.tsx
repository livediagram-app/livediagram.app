import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The /import page's tab title; `index: false` is inherited from the root layout.
export const metadata: Metadata = {
  title: 'Import | livediagram',
};

export default function ImportLayout({ children }: { children: ReactNode }) {
  return children;
}
