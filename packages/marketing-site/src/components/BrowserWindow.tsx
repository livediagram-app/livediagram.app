import type { ReactNode } from 'react';

// The browser every app illustration is shown in (liveworkspace/docs/specs/010-site/site.md "The front door", and
// each product's docs/specs/019-marketing/marketing-site.md "Feature scenes"): a desktop browser's compact
// toolbar, with its window controls, back and forward, the address with its padlock, and the share and new-tab
// buttons, round the app's own screen, on a layered shadow so the window sits on the page like a real one.
// One frame for every app, so the illustrations read as one family. Decorative: the caller's art carries the
// meaning, so the browser's own toolbar is hidden from assistive tech and the screen inside is left as the caller
// marks it.

// The shadow a real window casts: a hairline contact shadow, a soft near shadow and a wide, faint far one.
const SHADOW =
  'shadow-[0_1px_1px_rgb(15_23_42/0.05),0_6px_12px_-4px_rgb(15_23_42/0.08),0_24px_48px_-12px_rgb(15_23_42/0.18),0_56px_96px_-32px_rgb(15_23_42/0.22)] dark:shadow-[0_1px_1px_rgb(0_0_0/0.4),0_8px_16px_-4px_rgb(0_0_0/0.4),0_32px_64px_-16px_rgb(0_0_0/0.6)]';

// A toolbar glyph, drawn in the browser's quiet grey at one stroke weight.
function Glyph({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-3.5 shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const SIDEBAR = 'M2.5 3.5h11v9h-11zM6.5 3.5v9';
const BACK = 'M10 3.5 5.5 8l4.5 4.5';
const FORWARD = 'M6 3.5 10.5 8 6 12.5';
const RELOAD = 'M12.5 8a4.5 4.5 0 1 1-1.4-3.3M12.5 2.5v2.6H9.9';
const SHARE = 'M8 10V2.5M5.5 5 8 2.5 10.5 5M4.5 7.5h-1v6h9v-6h-1';
const PLUS = 'M8 3v10M3 8h10';
const TABS = 'M4.5 4.5V3h9v7.5H12M2.5 5.5h9v7.5h-9z';

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// The address a piece of work opens at, as the apps write it: the app's site, its route and an id. The id is made
// from the work's name, so each window shows a real-looking address that stays the same on every render.
export function workAddress(site: string, route: string, name: string): string {
  let hash = 2166136261;
  for (const ch of name) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += ID_CHARS[hash % ID_CHARS.length];
    hash = Math.imul(hash ^ (hash >>> 13), 2246822519) >>> 0;
  }
  return `${site}/${route}/${id}`;
}

export function BrowserWindow({
  address,
  children,
  className = '',
}: {
  // What the address bar shows: the site, then the path, which is drawn fainter as browsers draw it.
  address: string;
  children: ReactNode;
  className?: string;
}) {
  const slash = address.indexOf('/');
  const host = slash === -1 ? address : address.slice(0, slash);
  const path = slash === -1 ? '' : address.slice(slash);
  return (
    <div
      className={`@container/browser overflow-hidden rounded-[14px] bg-white ring-1 ring-slate-900/10 select-none dark:bg-slate-900 dark:ring-white/10 ${SHADOW} ${className}`}
    >
      <div
        aria-hidden
        className="relative flex h-9 items-center gap-3 border-b border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100/90 px-3.5 text-slate-400 dark:border-black/40 dark:from-slate-800 dark:to-slate-800/80 dark:text-slate-500"
      >
        {/* The window controls, in their own colours with the hairline rim real ones have. */}
        <span className="flex shrink-0 gap-[7px]">
          <span className="size-[11px] rounded-full bg-[#ff5f57] ring-1 ring-black/10 ring-inset" />
          <span className="size-[11px] rounded-full bg-[#febc2e] ring-1 ring-black/10 ring-inset" />
          <span className="size-[11px] rounded-full bg-[#28c840] ring-1 ring-black/10 ring-inset" />
        </span>
        <span className="hidden items-center gap-2.5 @min-[460px]/browser:flex">
          <Glyph d={SIDEBAR} />
          <Glyph d={BACK} />
          <Glyph d={FORWARD} className="opacity-50" />
        </span>
        {/* The address, centred on the window as the compact toolbar centres it. */}
        <span className="mx-auto flex h-[22px] w-full max-w-[min(26rem,62%)] min-w-0 items-center justify-center gap-1.5 rounded-md bg-slate-200/70 px-2.5 text-[11px] leading-none dark:bg-slate-900/70">
          <svg viewBox="0 0 16 16" className="size-2.5 shrink-0 text-slate-500" fill="currentColor">
            <path d="M4.5 7V5.5a3.5 3.5 0 0 1 7 0V7h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm1.6 0h3.8V5.5a1.9 1.9 0 0 0-3.8 0z" />
          </svg>
          <span className="truncate">
            <span className="font-medium text-slate-700 dark:text-slate-200">{host}</span>
            <span className="text-slate-400 dark:text-slate-500">{path}</span>
          </span>
          <Glyph d={RELOAD} className="ml-auto hidden size-3 @min-[460px]/browser:block" />
        </span>
        <span className="hidden items-center gap-2.5 @min-[460px]/browser:flex">
          <Glyph d={SHARE} />
          <Glyph d={PLUS} />
          <Glyph d={TABS} />
        </span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
