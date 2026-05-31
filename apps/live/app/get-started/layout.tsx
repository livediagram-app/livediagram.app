import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create your account | livediagram',
  description: 'Sign up for a livediagram account to keep your diagrams across devices.',
};

export default function GetStartedLayout({ children }: { children: ReactNode }) {
  return children;
}
