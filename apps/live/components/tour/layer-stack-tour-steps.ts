import type { ElementTourApi } from './element-tour-api';
import {
  addRowStep,
  conceptOutro,
  inTheMenu,
  onGraphic,
  type ConceptTourContext,
} from './concept-element-tour-steps';
import type { TourStepOf } from './tour-step';
import { elementSelector } from '@/lib/canvas-selectors';

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
      'Each band is a layer, top to bottom. Resize it and the bands share the height again; the words re-wrap, never stretch.',
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
            'A note sits beside its layer, joined by a rule: the tool, the team, the detail. Clear every note and the bands take the full width.',
            elementSelector(id, `[data-concept-note="${noted}"]`),
          ),
        ]
      : []),
    addRowStep(
      'add',
      'Add a Layer',
      'Add Layer puts a new band at the bottom, up to eight. The others make room.',
      'Add Layer',
    ),
    ...(ctx.hasMore
      ? [
          inTheMenu(
            'rows',
            'Reorder in the Menu',
            'Under Tools, Rows lists every layer: rename it, give it a note, move it up or down, or remove it (two stay).',
          ),
        ]
      : []),
    onGraphic(
      'colours',
      'One Colour, a Whole Ramp',
      `The top layer takes the accent and each one below steps toward the fill. Change the colour and all ${ctx.rows.length} follow, their words kept readable.`,
      elementSelector(id, `[data-concept-row="${Math.max(0, last)}"]`),
    ),
    onGraphic(
      'animate',
      'Build It Up',
      'Animation, then Concept: Build brings the layers in top to bottom, as here. Pulse lights each in turn.',
      elementSelector(id),
      'build',
    ),
    conceptOutro(
      'That Is a Layer Stack',
      'It exports exactly as drawn, and every change is one undo step.',
    ),
  ];
}
