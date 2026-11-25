// The tab a tool's `tabId` argument means (each product's docs/specs/015-api/mcp-server.md "A tab by its name"): its
// id, or its name when exactly one tab has it. A caller that made the tabs knows them by name, and an unknown id was
// already refused with every tab's name beside its id, a call spent to learn what the name said.

import { ToolInputError } from './tool-result';

type NamedTab = { readonly id: string; readonly name: string };

/** The id of the tab `given` names, by id first, else by a name one tab alone has (any case); undefined for none. */
export function tabIdNamed(tabs: readonly NamedTab[], given: string): string | undefined {
  if (tabs.some((t) => t.id === given)) return given;
  const key = given.trim().toLowerCase();
  const named = tabs.filter((t) => t.name.trim().toLowerCase() === key);
  return named.length === 1 ? named[0]!.id : undefined;
}

/**
 * After a tab route answered a bare 404 (renaming a tab, a Pages call): when the file's tabs can be read and none is
 * `tabId`, a ToolInputError naming them, since the 404 alone reads as "no such file". Returns when the file cannot be
 * read (then the file is what is missing) or does hold the tab, so the caller rethrows the 404 it had.
 */
export async function refuseUnknownTab(
  readTabs: () => Promise<readonly NamedTab[]>,
  tabId: string,
  word: string,
): Promise<void> {
  let tabs: readonly NamedTab[];
  try {
    tabs = await readTabs();
  } catch {
    return;
  }
  if (tabs.some((t) => t.id === tabId)) return;
  throw new ToolInputError(
    `No tab "${tabId}" in this ${word}. Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
  );
}
