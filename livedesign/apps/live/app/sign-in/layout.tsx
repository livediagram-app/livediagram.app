import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign in | livepages',
  description: 'Sign in to your livepages account to keep your documents across devices.',
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
