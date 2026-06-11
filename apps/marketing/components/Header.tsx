import { Brand } from '@livediagram/ui';

import { ShareButtons } from './ShareButtons';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Brand href="/" size="md" />
        <div className="flex items-center gap-3">
          <ShareButtons />
          {/* Quiet utility link to the editor's full Explorer page (open to
              guests). Ghost-styled and a notch quieter than the Share button
              (text-slate-500) so the "Start drawing" CTA stays dominant.
              Label hides on mobile, mirroring Share's. */}
          <a
            href="/explorer/recent"
            aria-label="Open Explorer"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <ExplorerNavIcon />
            <span className="hidden sm:inline">Explorer</span>
          </a>
          <a
            href="/new"
            className="inline-flex items-center rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Start drawing
          </a>
        </div>
      </div>
    </header>
  );
}

function ExplorerNavIcon() {
  // Folder glyph — mirrors the Explorer's own folder language so the link
  // reads as "go to your library" (matches the live app's header link).
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5C2 3.7 2.7 3 3.5 3h3l2 2h4c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5h-9C2.7 13 2 12.3 2 11.5v-7z" />
    </svg>
  );
}
