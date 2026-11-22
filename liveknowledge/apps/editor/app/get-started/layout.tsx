import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create your account | liveknowledge',
  description: 'Sign up for a liveknowledge account to keep your knowledgebases across devices.',
};

export default function GetStartedLayout({ children }: { children: ReactNode }) {
  return children;
}
