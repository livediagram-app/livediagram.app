// A person's initials on their colour (an assignee, a swimlane, a presence tag), painted through the
// identity fill so dark mode deepens the colour under the white text (docs/specs/004-interface-design/
// color-scheme.md "Dark palette rules"), and optically centred.
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';
import type { ItemPerson } from '@livediagram/items';
import { initialsOf } from './plan-palette';

export function PersonDisc({ person, label }: { person: ItemPerson; label?: string }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${IDENTITY_FILL}`}
      style={identityVars(person.color)}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="text-optical-centre">{initialsOf(person.name)}</span>
    </span>
  );
}

// A presence tag: the first name of whoever is dragging or reading a card, on their colour.
export function PresenceTag({ name, color }: { name: string; color: string }) {
  return (
    <span
      className={`absolute -top-px right-2 rounded-b px-1.5 text-[10px] font-semibold text-white ${IDENTITY_FILL}`}
      style={identityVars(color)}
    >
      {name.split(/\s+/)[0]}
    </span>
  );
}
