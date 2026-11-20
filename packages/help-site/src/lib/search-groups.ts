import { appliesTo, type HelpScope, type SearchEntry } from '@liveworkspace/help-registry';

// The one help centre's search panel (liveworkspace/docs/specs/017-help/help-centre.md "Search"), grouped by the page's
// scope. In an app's help the results from its own index come first, then up to three from the every-app index that
// apply only to other apps (once that index has loaded); under All Apps one list. A help centre with no scope keeps
// its one list.

/** The most "From other apps" results an app's panel shows. */
export const OTHER_APPS_MAX = 3;

export interface SearchGroups {
  /** Results for the scope (all of them under All Apps or with no scope), best first. */
  here: SearchEntry[];
  /** Up to OTHER_APPS_MAX results that apply only to other apps, best first. Empty under All Apps. */
  elsewhere: SearchEntry[];
}

/** `results` from the scope's own index, then `others` (results from the every-app index, or none while it loads):
 *  the scope's own results in `here`, any of `results` that do not apply to the scope and the first of `others`
 *  that do not, up to OTHER_APPS_MAX, in `elsewhere`. */
export function groupResults(
  results: readonly SearchEntry[],
  scope: HelpScope | undefined,
  others: readonly SearchEntry[] = [],
): SearchGroups {
  if (!scope || scope === 'all') return { here: [...results], elsewhere: [] };
  const here: SearchEntry[] = [];
  const elsewhere: SearchEntry[] = [];
  for (const article of [...results, ...others]) {
    if (appliesTo(article, scope)) {
      if (!others.includes(article)) here.push(article);
    } else if (elsewhere.length < OTHER_APPS_MAX) elsewhere.push(article);
  }
  return { here, elsewhere };
}
