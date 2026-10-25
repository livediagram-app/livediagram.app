'use client';

import { useState } from 'react';
import { tagColourOf, type ShapeElement, type TagColour } from '@liveplanner/project';
import { ColourRow, type ColourPalette } from '@/components/palette/context-menu-input-rows';
import { MenuActionButton } from '@liveworkspace/workbench/components/primitives/PortalMenu';

// The Card section's Tag Colours (docs/specs/009-elements/tag-colours.md "Editing"): one colour row per tag on the card,
// in the one colour picker. A pick colours that tag across the whole tab; Clear removes it from the map.
export function TagColoursBlock({
  target,
  tagColours,
  colourPalette,
  onSetTagColour,
}: {
  target: ShapeElement;
  tagColours: readonly TagColour[] | undefined;
  colourPalette: ColourPalette;
  onSetTagColour: (tag: string, colour: string | null) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const tags = (target.tags ?? []).filter((t) => t.trim());
  if (tags.length === 0) return null;
  return (
    <div className="px-2 pb-1.5 pt-1" data-testid="tag-colours">
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Tag Colours
      </p>
      {tags.map((tag) => {
        const colour = tagColourOf(tagColours, tag);
        return (
          <div key={tag} className="flex flex-col">
            <ColourRow
              label={tag}
              value={colour ?? '#94a3b8'}
              open={open === tag}
              onToggle={() => setOpen((o) => (o === tag ? null : tag))}
              // The picker's No Colour is `transparent`: for a tag, that clears its colour.
              onChange={(c) => onSetTagColour(tag, c === 'transparent' ? null : c)}
              {...colourPalette}
            />
            {colour ? (
              <div className="pb-1 pl-1">
                <MenuActionButton
                  label={`Clear ${tag} colour`}
                  onClick={() => onSetTagColour(tag, null)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
