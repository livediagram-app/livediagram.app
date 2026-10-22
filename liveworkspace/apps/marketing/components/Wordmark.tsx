// The liveworkspace wordmark: a tile of four squares, one in each app's accent and the rest in the
// platform's slate, beside the name. Drawn here rather than borrowed from an app, whose logo is its own.

import { APP_SITES, PLATFORM_SITE } from '@liveworkspace/sites';

const SQUARES = [
  ...APP_SITES.map((s) => s.accent),
  PLATFORM_SITE.accent,
  PLATFORM_SITE.accent,
].slice(0, 4);

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden
        className="grid size-7 grid-cols-2 gap-0.5 rounded-lg bg-slate-900 p-1 dark:bg-white"
      >
        {SQUARES.map((colour, i) => (
          <span key={i} className="rounded-[3px]" style={{ backgroundColor: colour }} />
        ))}
      </span>
      <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
        live<span className="text-slate-500 dark:text-slate-400">workspace</span>
      </span>
    </span>
  );
}
