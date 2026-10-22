import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create your account | livedocuments',
  description: 'Sign up for a livedocuments account to keep your documents across devices.',
};

export default function GetStartedLayout({ children }: { children: ReactNode }) {
  return children;
}
