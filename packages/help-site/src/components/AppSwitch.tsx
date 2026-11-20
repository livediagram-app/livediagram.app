'use client';

import { useMemo, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { APP_ORDER, isAppId, type AppId, type HelpScope } from '@liveworkspace/help-registry';
import { switchHref, withQuery } from '@liveworkspace/help-registry/hrefs';
import { useClickOutside, useMenu, useMenuButton } from '@liveworkspace/ui';
import { useHelpClient } from '../client';
import { getSearchQuery, subscribeSearchQuery } from '../lib/search-query';
import { AppMark } from './AppMarks';
import { useSiteHref } from './SiteLink';
import { CheckIcon, ChevronDownIcon } from './chrome-icons';

// The app switch (liveworkspace/docs/specs/017-help/help-centre.md "Choosing an app"): one dropdown at the left edge
// inside a search box, naming the scope the box searches (All Apps, or this app's mark and name). It opens one menu:
// All Apps, then every app, each with its guide count and the current scope ticked. Every choice is a link
// (`<a href>`), so it works without script, opens in a new tab and is crawlable; with script its `?q=` follows the
// search box as the reader types. Choosing moves the reader: to the same path on the target's address when the page
// applies there, else to the target's help home.
//
// The server knows the path but not which apps the page applies to (a client component in the shared header), so its
// links go to the same path and the target's Worker answers a page that does not apply with a 308 to its canonical
// address. Once hydrated, the switch reads the page's apps from `[data-help-applies]` (written by the article layout
// and the category landings) and links a page that does not apply to the target's home.

/** The element whose `data-help-applies` lists the apps the page applies to, comma separated. */
export const HELP_APPLIES_ATTR = 'data-help-applies';

const noQuery = () => '';

/** The page's apps as its layout wrote them (`[data-help-applies]`), or null on a page that names none. A string, so
 *  React compares snapshots by value. */
function readAppliesAttr(): string | null {
  return document.querySelector(`[${HELP_APPLIES_ATTR}]`)?.getAttribute(HELP_APPLIES_ATTR) ?? null;
}
const noSubscription = () => () => {};

/** The guide count's words in a menu row. */
const guides = (n: number | undefined) =>
  n === undefined ? '' : `${n} ${n === 1 ? 'guide' : 'guides'}`;

/** All Apps' mark: the first four apps' marks in a small grid. */
function AllAppsMark({ cell }: { cell: number }) {
  return (
    <span aria-hidden className="grid shrink-0 grid-cols-2 gap-0.5">
      {APP_ORDER.slice(0, 4).map((a) => (
        <AppMark key={a} app={a} size={cell} />
      ))}
    </span>
  );
}

/** Where the trigger shows the scope's name beside its mark: always, or from a breakpoint up. */
export type AppSwitchLabel = 'always' | 'sm' | 'lg';
const LABEL_CLASS: Record<AppSwitchLabel, string> = {
  always: '',
  sm: 'max-sm:sr-only',
  lg: 'max-lg:sr-only',
};

export function AppSwitch({
  large = false,
  label = 'always',
}: {
  /** The home hero's size. */
  large?: boolean;
  label?: AppSwitchLabel;
}) {
  const client = useHelpClient();
  const { facts } = client;
  const scope = facts.scope;
  const pathname = usePathname() ?? '/';
  const query = useSyncExternalStore(subscribeSearchQuery, getSearchQuery, noQuery);
  // Each scope's address in the page's deployment: staging stays on staging, a dev server on its ports.
  const siteHref = useSiteHref();
  // Read on every render and checked again after each commit (useSyncExternalStore), so a client navigation, which
  // swaps the article under a header that stays, is picked up once the new page is in the DOM.
  const appliesAttr = useSyncExternalStore(noSubscription, readAppliesAttr, () => null);
  const applies = useMemo<AppId[] | undefined>(
    () => (appliesAttr === null ? undefined : appliesAttr.split(',').filter(isAppId)),
    [appliesAttr],
  );
  const { open, close, trigger, initialFocus, triggerProps } = useMenuButton();
  const { attach, surfaceProps } = useMenu({
    open,
    onClose: close,
    trigger,
    initialFocus,
    label: 'Choose an app',
  });
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close, open);

  if (!scope) return null;
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const hrefTo = (target: HelpScope) =>
    withQuery(siteHref(switchHref(target, path, applies)), query);
  const counts = facts.guideCounts ?? {};
  const isAll = scope === 'all';
  const name = isAll ? 'All Apps' : scope;

  const row = (target: HelpScope) => {
    const ticked = target === scope;
    return (
      <a
        key={target}
        href={hrefTo(target)}
        role="menuitemradio"
        aria-checked={ticked}
        tabIndex={-1}
        onClick={() => {
          if (!ticked) client.track('Help', 'Changed', `Scope.${target}`);
          close();
        }}
        className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-micro md:min-h-0 ${
          ticked
            ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-700/60 dark:text-slate-100'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <span aria-hidden className="inline-flex size-5 items-center justify-center">
          {target === 'all' ? <AllAppsMark cell={8} /> : <AppMark app={target} size={20} />}
        </span>
        <span className="flex-1">{target === 'all' ? 'All Apps' : target}</span>
        <span className="text-xs text-slate-400 dark:text-slate-500">{guides(counts[target])}</span>
        {ticked && <CheckIcon size={14} className="text-brand-600 dark:text-brand-300" />}
      </a>
    );
  };
  const heading = (text: string) => (
    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {text}
    </p>
  );
  return (
    <div ref={ref} data-app-switch="" className="relative flex shrink-0 self-stretch">
      <button
        type="button"
        {...triggerProps}
        aria-label={`Searching ${name}, choose an app`}
        // The box's left edge, its corners rounded with it; a hairline divides it from the field.
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-l-[11px] border-r border-slate-200 font-medium text-slate-700 transition-colors duration-micro hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:hover:text-slate-100 ${
          large ? 'gap-2 pl-4 pr-3 text-base' : 'pl-3 pr-2 text-sm'
        } ${open ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}
      >
        {isAll ? (
          <AllAppsMark cell={large ? 9 : 7} />
        ) : (
          <AppMark app={scope} size={large ? 20 : 16} />
        )}
        <span className={LABEL_CLASS[label]}>{name}</span>
        <ChevronDownIcon
          size={12}
          className={`text-slate-400 transition-transform duration-micro ${open ? '[transform:rotate(180deg)]' : ''}`}
        />
      </button>

      {open && (
        <>
          {/* On a phone the menu is a bottom sheet over a scrim, its rows 44px tall; from md it hangs from the
              switch. */}
          <div
            aria-hidden
            onClick={close}
            className="fixed inset-0 z-40 bg-slate-950/30 md:hidden"
          />
          <div
            ref={attach}
            {...surfaceProps}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-left shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-800 md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-2 md:w-72 md:rounded-xl md:p-1.5 md:shadow-lg md:shadow-slate-900/10 dark:md:shadow-black/30"
          >
            <span
              aria-hidden
              className="mx-auto mb-1 mt-0.5 block h-1 w-10 rounded-full bg-slate-300 md:hidden dark:bg-slate-600"
            />
            {row('all')}
            {heading('Apps')}
            {APP_ORDER.map((a) => row(a))}
          </div>
        </>
      )}
    </div>
  );
}
