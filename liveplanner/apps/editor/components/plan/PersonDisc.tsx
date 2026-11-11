// A person's initials on their colour (an assignee, a swimlane, a presence tag), painted through the
// identity fill so dark mode deepens the colour under the white text (docs/specs/004-interface-design/
// color-scheme.md "Dark palette rules"), and optically centred.
import { GlyphDisc, IDENTITY_FILL, identityVars } from '@liveplanner/ui';
import { initialsOf } from '@liveplanner/project';
import { AUTOMATION_PERSON_ID, type ItemPerson } from '@liveplanner/items';
import { BoltIcon } from '@/components/automations/automation-glyphs';

export function PersonDisc({ person, label }: { person: ItemPerson; label?: string }) {
  // A rule's change is by Automation: its bolt on the brand tint, never the rule name's initials
  // (docs/specs/026-plan/automations.md "On cards").
  if (person.id === AUTOMATION_PERSON_ID)
    return (
      <GlyphDisc
        size={20}
        data-automation-disc=""
        className="bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200"
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <BoltIcon size={11} aria-hidden />
      </GlyphDisc>
    );
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
