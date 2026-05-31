import { Brand } from '@livediagram/ui';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Brand href="/" size="md" />
        <div className="flex items-center gap-3">
          <a
            href="/live/new"
            className="inline-flex items-center rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Open the canvas
          </a>
        </div>
      </div>
    </header>
  );
}
