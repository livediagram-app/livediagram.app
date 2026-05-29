import { Brand } from '@livediagram/ui';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-sm text-slate-500">
            Diagrams and mindmaps for teams who think together.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <a href="#terms" className="hover:text-slate-900">
            Terms
          </a>
          <a href="#privacy" className="hover:text-slate-900">
            Privacy
          </a>
          <a href="#contact" className="hover:text-slate-900">
            Contact
          </a>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} livediagram. MIT licensed.
        </div>
      </div>
    </footer>
  );
}
