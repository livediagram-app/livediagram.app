import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@/components/providers/ClerkProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'livediagram',
  description: 'Build diagrams and mindmaps. Multiplayer canvas.',
};

// ClerkProvider wraps everything so `useAuth` / `useSignIn` / `useSignUp`
// work in every page — including the editor. Per spec/04 this is NOT a
// route gate: the editor stays open to guests forever. Auth is purely
// additive (signed-in users get per-account persistence; guests keep
// the localStorage participant id).
//
// The existing app/not-found.tsx → EditorPage mechanism (spec/14, fixes
// the static-export dynamic-segment 404) is unaffected by the provider
// — ClerkProvider doesn't touch the route tree.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 antialiased">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
