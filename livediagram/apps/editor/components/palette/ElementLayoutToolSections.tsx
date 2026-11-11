'use client';

// The Tools flyout's sections for the laid-out elements (docs/specs/008-canvas/canvas-and-palette.md): a concept
// graphic, a boundary, a badge or step number, a stack, a sequence diagram, a pointer note, a card and the web
// components' rows. Split out of ElementDataSections, which renders it in the same place in the flyout.

import { isConceptShape, type ConceptShape, type ShapeElement } from '@livediagram/document';
import { CardMenuSection } from '@/components/palette/CardMenuSection';
import { ChipMenuSection } from '@/components/palette/ChipMenuSection';
import { PointerNoteMenuSection } from '@/components/palette/PointerNoteMenuSection';
import { TagColoursBlock } from '@/components/palette/TagColoursBlock';
import { StackMenuSection } from '@/components/palette/StackMenuSection';
import { BoundaryMenuSection } from '@/components/palette/BoundaryMenuSection';
import { ConceptMenuSection } from '@/components/palette/ConceptMenuSection';
import { SequenceMenuSection } from '@/components/palette/SequenceMenuSection';
import {
  hasWebRowsSection,
  WebRowsMenuSection,
} from '@/components/palette/context-menu-web-editors';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from '@liveworkspace/workbench/components/palette/useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

export function ElementLayoutToolSections({
  props,
  shapeTarget,
  isChip,
  sectionProps,
}: {
  props: EditorContextMenuProps;
  shapeTarget: ShapeElement | null;
  isChip: boolean;
  sectionProps: Scaffold['sectionProps'];
}) {
  return (
    <>
      {/* Web components (docs/specs/009-elements/web-components-and-no-groups.md): a stat row's cards, a process's
        steps, a header's links: add / remove / reorder. */}
      {/* A concept graphic's variant; its animation is in the Animation row (docs/specs/009-elements/concept-graphics.md). */}
      {shapeTarget && isConceptShape(shapeTarget.shape) ? (
        <ConceptMenuSection
          target={shapeTarget as ShapeElement & { shape: ConceptShape }}
          ops={props.elementStyle}
          sectionProps={sectionProps}
        />
      ) : null}
      {/* A boundary's style (docs/specs/009-elements/boundary.md). */}
      {shapeTarget?.shape === 'boundary' ? (
        <BoundaryMenuSection
          target={shapeTarget}
          ops={props.elementStyle}
          sectionProps={sectionProps}
        />
      ) : null}
      {/* A badge's or step number's look, Detach, Renumber, Play in Order (docs/specs/009-elements/badge.md). */}
      {shapeTarget && isChip ? (
        <ChipMenuSection
          target={shapeTarget}
          ops={props.elementStyle}
          stepsInOrder={props.elements.some(
            (el) => el.type === 'shape' && el.shape === 'step' && el.stepSequence === true,
          )}
          sectionProps={sectionProps}
        />
      ) : null}
      {/* A stack's arrangement (docs/specs/009-elements/stack.md). */}
      {shapeTarget?.shape === 'stack' ? (
        <StackMenuSection
          target={shapeTarget}
          ops={props.elementStyle}
          sectionProps={sectionProps}
        />
      ) : null}
      {/* A sequence diagram's summary, Edit Sequence and Numbered; Play is in the Animation row
          (docs/specs/009-elements/sequence-diagram.md "The menu"). */}
      {shapeTarget?.shape === 'sequence' ? (
        <SequenceMenuSection
          target={shapeTarget}
          ops={props.elementStyle}
          sectionProps={sectionProps}
          onEdit={props.onEditSequence}
        />
      ) : null}
      {/* A pointer note's Detach (docs/specs/009-elements/pointer-note.md). */}
      {shapeTarget?.shape === 'pointer-note' ? (
        <PointerNoteMenuSection
          target={shapeTarget}
          ops={props.elementStyle}
          sectionProps={sectionProps}
        />
      ) : null}
      {/* The card's slots (docs/specs/009-elements/card.md): band, title, meta line, media. */}
      {shapeTarget?.shape === 'card' ? (
        <CardMenuSection
          target={shapeTarget}
          ops={props.elementStyle}
          sectionProps={sectionProps}
          tagColours={
            props.onSetTagColour ? (
              <TagColoursBlock
                target={shapeTarget}
                tagColours={props.tagColours}
                colourPalette={props.colourPalette}
                onSetTagColour={props.onSetTagColour}
              />
            ) : null
          }
        />
      ) : null}
      {shapeTarget && hasWebRowsSection(shapeTarget) ? (
        <WebRowsMenuSection
          target={shapeTarget}
          sectionProps={sectionProps}
          onSetRows={props.onSetWebRows}
        />
      ) : null}
    </>
  );
}
