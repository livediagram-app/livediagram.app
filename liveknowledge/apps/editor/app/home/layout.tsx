import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// A person's own start: nothing for a search engine.
export const metadata: Metadata = {
  title: 'Home | liveknowledge',
  robots: { index: false, follow: false },
};

export default function HomeLayout({ children }: { children: ReactNode }) {
  return children;
}
