// Who did an event, by name and initials: an item's History and Home's Spaces name people this way. The index keeps
// no names, so an app's report may carry one, and anyone else is a stand-in.

import type { ItemEvent } from '@liveworkspace/index-client';

/** Who did it, by name. The index keeps no names: an app's report may carry one. */
export function personName(event: Pick<ItemEvent, 'actorId' | 'actorName'>): string {
  const name = event.actorName?.trim();
  if (name) return name;
  if (event.actorId === 'deleted') return 'A closed account';
  return 'A teammate';
}

/** A person's initials for their avatar: "Sam Lee" → "SL"; "A teammate" has none. */
export function initials(name: string): string | null {
  if (name === 'A teammate' || name === 'A closed account') return null;
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.slice(0, 1);
  const out = letters.map((w) => [...w][0]!.toUpperCase()).join('');
  return out || null;
}
