import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@/components/providers/ClerkProvider';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { ToastProvider } from '@/hooks/useToast';
import './globals.css';

// The live app is the product, not a content surface. Every route
// under /live/* is either a signed-in workspace carrying private
// user data, an auth flow that's worthless to crawlers, or the
// welcome flow that needs runtime identity to mean anything.
// `noindex, nofollow` at the root layout cascades through every
// nested page in the static export. See spec/07 "SEO and indexing".
export const metadata: Metadata = {
  title: 'livediagram',
  description: 'Build diagrams and mindmaps. Multiplayer canvas.',
  robots: {
    index: false,
    follow: false,
  },
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
    <html lang="en-GB">
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-100">
        <ClerkProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
