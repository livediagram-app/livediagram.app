import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign in | livediagram',
  description: 'Sign in to your livediagram account to keep your documents across devices.',
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
