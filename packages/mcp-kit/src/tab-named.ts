// The tab a tool's `tabId` argument means (each product's docs/specs/015-api/mcp-server.md "A tab by its name"): its
// id, or its name when exactly one tab has it. A caller that made the tabs knows them by name, and an unknown id was
// already refused with every tab's name beside its id, a call spent to learn what the name said.

type NamedTab = { readonly id: string; readonly name: string };

/** The id of the tab `given` names, by id first, else by a name one tab alone has (any case); undefined for none. */
export function tabIdNamed(tabs: readonly NamedTab[], given: string): string | undefined {
  if (tabs.some((t) => t.id === given)) return given;
  const key = given.trim().toLowerCase();
  const named = tabs.filter((t) => t.name.trim().toLowerCase() === key);
  return named.length === 1 ? named[0]!.id : undefined;
}
