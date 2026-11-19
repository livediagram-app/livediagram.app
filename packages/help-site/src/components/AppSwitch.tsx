'use client';

import { useMemo, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import {
  APP_ORDER,
  isAppId,
  scopeLabel,
  type AppId,
  type HelpScope,
} from '@liveworkspace/help-registry';
import { switchHref, withQuery } from '@liveworkspace/help-registry/hrefs';
import { useClickOutside, useMenu, useMenuButton } from '@liveworkspace/ui';
import { useHelpClient } from '../client';
import { getSearchQuery, subscribeSearchQuery } from '../lib/search-query';
import { AppMark } from './AppMarks';
import { useSiteHref } from './SiteLink';
import { CheckIcon, ChevronDownIcon } from './chrome-icons';

// The app switch (liveworkspace/docs/specs/016-help/help-centre.md "Choosing an app"): a segment naming the current
// scope with a caret, and an All Apps segment. The caret opens a menu of This App (ticked), All Apps and Another App,
// each with its guide count. Every choice is a link (`<a href>`), so it works without script, opens in a new tab and
// is crawlable; with script its `?q=` follows the search box as the reader types. Choosing moves the reader: to the
// same path on the target's address when the page applies there, else to the target's help home.
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

export function AppSwitch({ size = 'header' }: { size?: 'header' | 'large' | 'chip' }) {
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
  const others = APP_ORDER.filter((a) => a !== scope);
  const large = size === 'large';
  const segment = `inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-brand-600 ${
    large ? 'text-sm' : 'text-xs'
  }`;
  const selected = 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-100';
  const idle =
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';

  const row = (target: HelpScope, ticked: boolean) => (
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
      {target === 'all' ? (
        <span aria-hidden className="inline-flex size-5 items-center justify-center">
          <span className="grid grid-cols-2 gap-0.5">
            {APP_ORDER.slice(0, 4).map((a) => (
              <AppMark key={a} app={a} size={8} />
            ))}
          </span>
        </span>
      ) : (
        <AppMark app={target} size={20} />
      )}
      <span className="flex-1">{target === 'all' ? 'All Apps' : target}</span>
      <span className="text-xs text-slate-400 dark:text-slate-500">{guides(counts[target])}</span>
      {ticked && <CheckIcon size={14} className="text-brand-600 dark:text-brand-300" />}
    </a>
  );
  const heading = (text: string) => (
    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {text}
    </p>
  );
  return (
    <div ref={ref} data-app-switch="" className="relative inline-flex shrink-0">
      <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          {...triggerProps}
          aria-label={isAll ? 'Choose App' : `${scopeLabel(scope)}, choose another app`}
          className={`${segment} ${isAll ? idle : selected}`}
        >
          {!isAll && <AppMark app={scope} size={large ? 18 : 16} />}
          <span>{isAll ? 'Choose App' : scope}</span>
          <ChevronDownIcon
            size={12}
            className={`transition-transform duration-micro ${open ? '[transform:rotate(180deg)]' : ''}`}
          />
        </button>
        <a
          href={hrefTo('all')}
          aria-current={isAll ? 'page' : undefined}
          onClick={() => {
            if (!isAll) client.track('Help', 'Changed', 'Scope.all');
          }}
          className={`${segment} ${isAll ? selected : idle}`}
        >
          All Apps
        </a>
      </div>

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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-800 md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-2 md:w-72 md:rounded-xl md:p-1.5 md:shadow-lg md:shadow-slate-900/10 dark:md:shadow-black/30"
          >
            <span
              aria-hidden
              className="mx-auto mb-1 mt-0.5 block h-1 w-10 rounded-full bg-slate-300 md:hidden dark:bg-slate-600"
            />
            {!isAll && (
              <>
                {heading('This App')}
                {row(scope, true)}
              </>
            )}
            {heading('All Apps')}
            {row('all', isAll)}
            {heading(isAll ? 'Choose App' : 'Another App')}
            {others.map((a) => row(a, false))}
          </div>
        </>
      )}
    </div>
  );
}
