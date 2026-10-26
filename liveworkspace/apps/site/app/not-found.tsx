import type { Metadata } from 'next';
import { Wordmark } from '@/components/Wordmark';

// Its own title, and no home-page Open Graph address: without this, the root layout's title, description and
// `og:url` of `/` made every unknown address announce itself as the home page. Never indexed.
const TITLE = 'Nothing here · liveworkspace';
const DESCRIPTION = 'liveworkspace has no page at this address.';
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: 'liveworkspace', type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

// An address liveworkspace.app has no page for. Kept light: Next carries this tree in every page.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-6 px-4">
      <a href="/">
        <Wordmark />
      </a>
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Nothing here</h1>
      <p className="text-slate-600 dark:text-slate-300">
        That page doesn’t exist. The apps are on the{' '}
        <a href="/" className="font-medium underline underline-offset-4">
          home page
        </a>
        .
      </p>
    </main>
  );
}
