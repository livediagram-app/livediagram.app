import type { ElementTourApi } from './element-tour-api';
import {
  addRowStep,
  conceptOutro,
  inTheMenu,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Layer Stack tour (docs/specs/007-editor/element-tours.md "The Layer Stack tour").
export function layerStackTourSteps(ctx: ConceptTourContext): TourStepOf<ElementTourApi>[] {
  const { elementId: id } = ctx;
  const click = ctx.touch ? 'Tap' : 'Click';
  const noted = ctx.rows.findIndex((r) => !!r.note);
  const last = ctx.rows.length - 1;
  return [
    onGraphic(
      'layers',
      'One Element, Many Layers',
      'Each band is a layer, top to bottom. Resize freely; the text never stretches.',
      elementSelector(id),
    ),
    onGraphic(
      'edit',
      'Type Over a Layer',
      `${click} a layer's name to type over it. Enter keeps it, Escape puts it back.`,
      elementSelector(id, '[data-concept-row="0"]'),
    ),
    ...(noted >= 0
      ? [
          onGraphic(
            'notes',
            'Side Notes',
            'Add a note beside any layer, like the tool or team behind it.',
            elementSelector(id, `[data-concept-note="${noted}"]`),
          ),
        ]
      : []),
    addRowStep('add', 'Add a Layer', 'Add Layer adds one at the bottom, up to eight.', 'Add Layer'),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'rows',
            'Reorder in the Menu',
            'In its menu, Tools › Rows lets you rename, reorder or remove layers.',
            ['Tools', 'Rows'],
          ),
        ]
      : []),
    onGraphic(
      'colours',
      'One Colour, a Whole Ramp',
      `Colours shade from the top layer down. Change the colour and all ${ctx.rows.length} follow.`,
      elementSelector(id, `[data-concept-row="${Math.max(0, last)}"]`),
    ),
    onGraphic(
      'animate',
      'Build It Up',
      'Animation › Concept builds the layers in or pulses through them.',
      elementSelector(id),
      'build',
    ),
    conceptOutro('That Is a Layer Stack', 'It exports as you see it. Undo takes back any change.'),
  ];
}
