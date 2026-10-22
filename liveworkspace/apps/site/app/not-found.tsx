import { Wordmark } from '@/components/Wordmark';

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
