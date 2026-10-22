'use client';

// A tag's colour, chosen with the one colour picker in its swatch-button skin (docs/specs/004-interface-design/
// colour-picker.md "Skins", docs/specs/013-workspace/tags.md "The tag picker"): the standard colours in the strong
// tone, stored by name so they redraw for dark, then Custom Colours (the custom colours the reader's other tags use).
// No Theme Palette: a tag belongs to no tab.

import type { ReactNode } from 'react';
import { isHexColour } from '@livediagram/document';
import { useAppearance } from '@livediagram/ui';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { ColourPopover } from '@/components/colour/ColourPopover';
import { standardGroup } from '@/components/colour/colour-options';
import { useDocumentTags } from './DocumentTagsProvider';
import { tagColourHex } from './tag-colour';

export const TAG_NO_THEME: readonly never[] = [];

// The picker's colours for a tag: the standard row, and the custom colours other tags use, newest tag first.
export function useTagColourOptions() {
  const { appearance } = useAppearance();
  const { tags } = useDocumentTags();
  const yours = [...tags]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((t) => t.colour)
    .filter(isHexColour);
  return {
    appearance,
    standard: [standardGroup('strong', appearance, 'name')],
    yours: [...new Set(yours)],
  };
}

// The editor's context is held off: a colour picked here is a tag's, not one of the open document's custom colours,
// and the tab's theme is not offered.
export function TagColourIsolation({ children }: { children: ReactNode }) {
  return <EditorContext.Provider value={null}>{children}</EditorContext.Provider>;
}

export function TagColourButton({
  name,
  colour,
  onPick,
}: {
  name: string;
  colour: string;
  onPick: (colour: string) => void;
}) {
  const { appearance, standard, yours } = useTagColourOptions();
  return (
    <TagColourIsolation>
      <ColourSwatchButton
        label={`Colour of ${name}`}
        value={colour}
        swatch={tagColourHex(colour, appearance)}
        theme={TAG_NO_THEME}
        standard={standard}
        yours={yours}
        onPick={onPick}
        // Quiet until its row is hovered or focused (the dot already shows the colour); always there on touch, and
        // while its picker is open.
        className="h-6 w-6 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
      />
    </TagColourIsolation>
  );
}

/** The same picker in a popover from any anchor: a tag menu's Change Colour. */
export function TagColourPopover({
  name,
  colour,
  anchor,
  onPick,
  onClose,
}: {
  name: string;
  colour: string;
  anchor: HTMLElement;
  onPick: (colour: string) => void;
  onClose: () => void;
}) {
  const { standard, yours } = useTagColourOptions();
  return (
    <TagColourIsolation>
      <ColourPopover
        label={`Colour of ${name}`}
        value={colour}
        theme={TAG_NO_THEME}
        standard={standard}
        yours={yours}
        anchor={anchor}
        onClose={onClose}
        onPick={(c) => {
          onPick(c);
          onClose();
        }}
      />
    </TagColourIsolation>
  );
}
