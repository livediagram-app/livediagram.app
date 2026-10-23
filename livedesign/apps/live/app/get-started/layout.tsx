import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create your account | livedesign',
  description: 'Sign up for a livedesign account to keep your designs across devices.',
};

export default function GetStartedLayout({ children }: { children: ReactNode }) {
  return children;
}
