'use client';

// Connect as tabs' row in every Send to picker (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send
// to"): the two files' app logos joined by a link, what connecting does, and the house switch at the end. Already
// connected, a tick takes the switch's place; with neither file's tabs the person's to change, the row is off and says
// why. The whole row is the switch (one hit target, at least 44px tall on a phone), named by its title and described
// by its line.
import { useId } from 'react';
import type { App } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import { SwitchRow, lucideGlyph } from '@liveworkspace/ui';
import { lucideCheck, lucideLink } from '@liveworkspace/icons/lucide';
import { linkTabsCopy, type LinkTabsNames } from './link-tabs-words';
import type { LinkTabs } from './useLinkTabs';

const LinkGlyph = lucideGlyph(lucideLink, 12);
const CheckGlyph = lucideGlyph(lucideCheck, 14);

const ROW =
  'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors motion-reduce:transition-none';

export function LinkTabsOption({
  link,
  sourceApp,
  targetApp,
  names,
  className = '',
}: {
  link: LinkTabs;
  sourceApp: App;
  targetApp: App;
  names: LinkTabsNames;
  className?: string;
}) {
  const lineId = useId();
  if (link.hidden) return null;
  const copy = linkTabsCopy(link.state, names);
  const pair = (
    <Pair
      sourceApp={sourceApp}
      targetApp={targetApp}
      lit={link.view === 'connected' || link.asks}
    />
  );
  const words = (
    <span className="flex min-w-0 flex-col">
      <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
        {copy.title}
      </span>
      <span
        id={lineId}
        className="text-xs leading-snug text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400"
      >
        {copy.line}
      </span>
    </span>
  );
  if (link.view === 'connected') {
    return (
      <div
        data-link-tabs="connected"
        role="status"
        className={`${ROW} border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10 ${className}`}
      >
        {pair}
        <span className="min-w-0 flex-1">{words}</span>
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500"
        >
          <CheckGlyph />
        </span>
      </div>
    );
  }
  const blocked = link.view === 'blocked';
  return (
    <SwitchRow
      checked={!blocked && link.on}
      onChange={link.setOn}
      disabled={blocked}
      aria-label={copy.title}
      aria-describedby={lineId}
      aria-busy={link.state.kind === 'loading' || undefined}
      data-link-tabs={blocked ? 'blocked' : link.on ? 'on' : 'off'}
      layout={ROW}
      className={`border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 ${className}`}
    >
      {/* At least 56px with the row's padding. The height lives in here, not on the row: a min-height on the row
          itself lets a phone sheet's overflowing grid squeeze it to that height, its words spilling out. */}
      <span className="flex min-h-9 min-w-0 items-center gap-3">
        {pair}
        {words}
      </span>
    </SwitchRow>
  );
}

// The two files' logos, each on its own small tab, joined by a link: grey while off, in colour once they will connect.
function Pair({ sourceApp, targetApp, lit }: { sourceApp: App; targetApp: App; lit: boolean }) {
  const tile =
    'flex size-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700';
  return (
    <span
      aria-hidden
      data-link-tabs-pair={lit ? 'lit' : 'dim'}
      className={`flex shrink-0 items-center transition-[filter,opacity] duration-short motion-reduce:transition-none ${
        lit ? '' : 'opacity-60 grayscale'
      }`}
    >
      <span className={tile}>
        <BrandMark app={sourceApp} className="size-4" />
      </span>
      <span
        className={`-mx-0.5 flex size-4 items-center justify-center rounded-full ${
          lit
            ? 'bg-brand-700 text-white dark:bg-brand-600'
            : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
        } z-10 ring-2 ring-white dark:ring-slate-900`}
      >
        <LinkGlyph />
      </span>
      <span className={tile}>
        <BrandMark app={targetApp} className="size-4" />
      </span>
    </span>
  );
}
