// Where a Form tab's responses go, as this session sees it (docs/specs/030-forms/forms.md "Publishing and the form
// link", "Responses to a Sheet"): the destination's tab, and what is wrong with it, if anything.
import type { Tab } from '@liveplanner/project';
import type { ItemTypeDef } from '@liveplanner/items';
import {
  destinationProblem,
  sheetDestinationProblem,
  type DestinationProblem,
  type FormDefinition,
} from '@liveplanner/forms';
import { boardsOf, sheetsOf } from '@liveplanner/templates';
import { isTabOutOfScope } from '@liveworkspace/workbench/lib/tab-scope';

export function formDestinationOf(
  form: FormDefinition,
  tabs: readonly Tab[],
  types: readonly ItemTypeDef[],
  // The one tab a tab-scoped share session reaches (docs/specs/013-workspace/tab-scoped-share-links.md); null for
  // everyone else.
  tabScope: string | null,
): { destTab: Tab | undefined; problem: DestinationProblem | null } {
  const destTabId = form.sheet?.tabId ?? form.destination?.tabId;
  // A destination on a tab this session can't reach (set by someone with wider access, on a link to the Form tab
  // alone) arrives as a nameless stub with no content. It can't be judged here, so it is never read as removed, nor
  // named: the api still checks it on every response.
  if (destTabId && isTabOutOfScope(destTabId, tabScope))
    return { destTab: undefined, problem: null };
  const destTab = tabs.find((t) => t.id === destTabId);
  const problem = form.sheet
    ? sheetDestinationProblem(form.sheet, sheetsOf(tabs))
    : destinationProblem(
        form.destination,
        destTab ? boardsOf(destTab).map((b) => b.setup) : [],
        types,
      );
  return { destTab, problem };
}
