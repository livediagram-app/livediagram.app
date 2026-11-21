// Insert a Value's options (liveworkspace/docs/specs/018-automations/automations.md "Values"; blueprint ui.md
// "Values"): the groups a text field offers are the app's (kit.values), built for the rule and the place the field
// sits in. What every app shares is their shape, the search, and an Incoming Webhook rule's Webhook Field… row.
// Pure.

export type ValueOption =
  | { kind: 'value'; id: string; label: string; name: string }
  // Opens the Webhook Field form: a path typed in, not a value picked.
  | { kind: 'webhook'; id: string; label: string };

export type ValueGroup = { id: string; label: string; options: readonly ValueOption[] };

/** A group of plain values, each named by `labels`. */
export function valueGroup<Name extends string>(
  id: string,
  label: string,
  names: readonly Name[],
  labels: Readonly<Record<Name, string>>,
): ValueGroup {
  return {
    id,
    label,
    options: names.map((name) => ({
      kind: 'value',
      id: `value:${name}`,
      label: labels[name],
      name,
    })),
  };
}

/** An Incoming Webhook rule's last group: a field of the call's body, by its path. */
export const WEBHOOK_VALUE_GROUP: ValueGroup = {
  id: 'webhook',
  label: 'Webhook',
  options: [{ kind: 'webhook', id: 'webhook', label: 'Webhook Field…' }],
};

/** The groups a search leaves: each option whose label holds the words typed, any case; empty groups go. */
export function filterValueGroups(groups: readonly ValueGroup[], query: string): ValueGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...groups];
  return groups
    .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(q)) }))
    .filter((g) => g.options.length > 0);
}
