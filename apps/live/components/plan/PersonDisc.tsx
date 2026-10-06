// A person's initials on their colour (an assignee, a swimlane, a presence tag), painted through the
// identity fill so dark mode deepens the colour under the white text (docs/specs/004-interface-design/
// color-scheme.md "Dark palette rules"), and optically centred.
import { GlyphDisc, IDENTITY_FILL, identityVars } from '@livediagram/ui';
import { initialsOf } from '@livediagram/document';
import type { ItemPerson } from '@livediagram/items';

export function PersonDisc({ person, label }: { person: ItemPerson; label?: string }) {
  return (
    <GlyphDisc
      size={20}
      className={`text-[9px] font-bold text-white ${IDENTITY_FILL}`}
      style={identityVars(person.color)}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {initialsOf(person.name)}
    </GlyphDisc>
  );
}

// A presence tag: the first name of whoever is dragging or reading a card, on their colour.
export function PresenceTag({ name, color }: { name: string; color: string }) {
  return (
    <span
      data-presence-tag=""
      className={`absolute -top-px right-2 rounded-b px-1.5 text-[10px] font-semibold text-white ${IDENTITY_FILL}`}
      style={identityVars(color)}
    >
      {name.split(/\s+/)[0]}
    </span>
  );
}
