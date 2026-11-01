import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign in | livehuddle',
  description: 'Sign in to your livehuddle account to keep your canvases across devices.',
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
