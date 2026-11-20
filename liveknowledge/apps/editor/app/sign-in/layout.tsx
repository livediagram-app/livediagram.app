import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign in | liveknowledge',
  description: 'Sign in to your liveknowledge account to keep your knowledgebases across devices.',
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
