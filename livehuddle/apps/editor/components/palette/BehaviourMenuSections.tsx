'use client';

// The element-menu section for the Reaction pad (docs/specs/009-elements/reaction-pad.md), the one Behaviour element
// left with a setting of its own. The Session button's, the Picker's and the Reveal zone's sections left with those
// elements (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements").
//
// Its own file for the same reason PortalMenuSection has one: none of it belongs in the data-shape sections beside
// charts and rails.

import {
  REACTION_DEFAULT,
  REACTION_EMOJI,
  REACTION_HINT,
  REACTION_LABEL,
  REACTIONS,
  type Reaction,
  type ShapeElement,
} from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';

// Reaction pad (docs/specs/009-elements/reaction-pad.md): which burst the pad throws.
//
// A tile grid rather than a dropdown, because the five reactions differ in
// FEELING rather than in name — the glyph is the thing being chosen, and a
// list of five words hides exactly the part the user is picking on. The hints
// spell out what each one is FOR, since "confetti or fireworks?" is a real
// question and both answers look like celebration.
export function ReactionMenuSection({
  element,
  onSetReaction,
  sectionProps,
}: {
  element: ShapeElement;
  onSetReaction: (reaction: Reaction) => void;
  sectionProps: { open: boolean; onToggle: () => void };
}) {
  const current = element.reaction ?? REACTION_DEFAULT;
  return (
    <MenuAccordionSection
      title="Reaction"
      icon={<span className="text-[13px] leading-none">{REACTION_EMOJI[current]}</span>}
      {...sectionProps}
    >
      <MenuTileGrid cols={3}>
        {REACTIONS.map((reaction) => (
          <MenuTile
            key={reaction}
            icon={<span className="text-[15px] leading-none">{REACTION_EMOJI[reaction]}</span>}
            label={REACTION_LABEL[reaction]}
            active={reaction === current}
            onClick={() => onSetReaction(reaction)}
          />
        ))}
      </MenuTileGrid>
      <p className="px-3 pb-1.5 pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        {REACTION_HINT[current]}. Press the pad, or walk a character onto it in Avatar mode.
      </p>
    </MenuAccordionSection>
  );
}
