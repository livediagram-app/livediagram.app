import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create your account | livehuddle',
  description: 'Sign up for a livehuddle account to keep your canvases across devices.',
};

export default function GetStartedLayout({ children }: { children: ReactNode }) {
  return children;
}
