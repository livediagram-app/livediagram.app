// Part of liveworkspace: a page with another app's item embedded live, each app named with its own logo (the
// shared brand component, mark and wordmark), and what the workspace gives every app: roles, Offline, Drive.
import { Brand } from '@liveworkspace/brand';
import type { BrandApp } from '@liveworkspace/brand';

import { ArtPanel, at } from './kit';

// The five other apps whose items a page can embed (docs/specs/030-knowledgebase/links-and-embeds.md).
const APPS: readonly BrandApp[] = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
];

const SHARED = ['Editor', 'Participant', 'Viewer', 'Offline', 'Google Drive'];

const CARD =
  'rounded-xl border-2 border-slate-900 bg-white shadow-[5px_5px_0_0_var(--color-brand-400)] dark:border-slate-200 dark:bg-slate-800';
const BAR = 'h-[7px] rounded-full';

// The embedded item's preview: a small flow of three steps, drawn rather than captured.
function FlowPreview() {
  return (
    <svg viewBox="0 0 240 64" className="h-full w-full">
      <g
        strokeWidth={1.75}
        className="fill-sky-50 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-400"
      >
        <rect x={8} y={18} width={56} height={28} rx={8} />
        <rect x={176} y={18} width={56} height={28} rx={8} />
        <path d="M120 10 L146 32 L120 54 L94 32 Z" strokeLinejoin="round" />
      </g>
      <g
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        className="fa-flow stroke-slate-500 dark:stroke-slate-400"
      >
        <path d="M66 32 H92" />
        <path d="M148 32 H174" />
      </g>
    </svg>
  );
}

export function WorkspaceArt() {
  return (
    <ArtPanel fluid>
      <div className="mx-auto flex max-w-md flex-col gap-5">
        {/* A page, with a diagram from livediagram embedded in the writing. */}
        <div className={`${CARD} p-4 sm:p-5`}>
          <p className="text-base leading-tight font-bold text-slate-900 dark:text-slate-50">
            Checkout Architecture
          </p>
          <div className="mt-3 space-y-1.5">
            <div className={`${BAR} w-11/12 bg-slate-300 dark:bg-slate-600`} />
            <div className={`${BAR} w-8/12 bg-slate-200 dark:bg-slate-700`} />
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <span className="flex min-w-0 items-center gap-2">
                <Brand app="livediagram" size="xs" />
                <span className="truncate text-[11px] text-slate-600 dark:text-slate-300">
                  Checkout Flow
                </span>
              </span>
              <span className="rounded-md bg-brand-700 px-2 py-0.5 text-[10.5px] font-semibold text-white">
                Open
              </span>
            </div>
            <div className="h-16 bg-white px-3 py-1.5 dark:bg-slate-800">
              <FlowPreview />
            </div>
          </div>
        </div>

        {/* Every app it sits beside, each under its own logo. */}
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {APPS.map((app, i) => (
            <li
              key={app}
              style={at(0.4 + i * 0.15)}
              className="kb-pop rounded-full border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800"
            >
              <Brand app={app} size="xs" />
            </li>
          ))}
        </ul>

        {/* What one account and one way of sharing give every app. */}
        <ul className="flex flex-wrap items-center justify-center gap-1.5">
          {SHARED.map((word, i) => (
            <li
              key={word}
              style={at(1.3 + i * 0.12)}
              className="kb-in rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100"
            >
              {word}
            </li>
          ))}
        </ul>
      </div>
    </ArtPanel>
  );
}
