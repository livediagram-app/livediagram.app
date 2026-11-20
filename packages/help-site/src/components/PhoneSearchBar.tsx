'use client';

import { usePathname } from 'next/navigation';
import { isHome, SearchInput } from './SearchInput';

// The search on a phone (liveworkspace/docs/specs/017-help/help-centre.md "Choosing an app"): the header has no room
// for it below `sm`, so it sits in a row under the header, with the app switch in its box. Not on the home, whose hero
// has the search.
export function PhoneSearchBar() {
  if (isHome(usePathname())) return null;
  return (
    <div className="border-b border-slate-200/70 bg-slate-50/80 px-4 py-2 sm:hidden dark:border-slate-800/70 dark:bg-slate-950/80">
      <SearchInput bar />
    </div>
  );
}
