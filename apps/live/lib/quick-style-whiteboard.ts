// The quick style panel on a whiteboard (docs/specs/023-whiteboard/whiteboard.md "The quick style panel
// stays"). An unpainted element there is drawn in the board's ink with no fill
// (inkWhiteboardElement), so the panel's slot-0 "theme default" swatches show
// that, and a shape left unfilled reads as the default rather than as a
// colour nobody picked.
import type { Element } from '@livediagram/document';
import type { QuickStyleView } from './quick-style';

export function onWhiteboard(
  view: QuickStyleView | null,
  selected: readonly Element[],
  ink: string,
): QuickStyleView | null {
  if (!view) return view;
  const withDefault = <S extends { swatches: { color: string }[] }>(
    section: S | undefined,
    color: string,
  ): S | undefined =>
    section && {
      ...section,
      swatches: section.swatches.map((s, i) => (i === 0 ? { ...s, color } : s)),
    };
  const { stroke, background, textColour } = view.sections;
  return {
    ...view,
    sections: {
      ...view.sections,
      stroke: withDefault(stroke, ink),
      textColour: withDefault(textColour, ink),
      background: background && {
        ...withDefault(background, 'transparent')!,
        // A whiteboard shape stores `transparent`, which IS the default there.
        value: unfilled(selected, view.targetIds) ? 0 : background.value,
      },
    },
  };
}

function unfilled(selected: readonly Element[], targetIds: readonly string[]): boolean {
  const ids = new Set(targetIds);
  return selected.every(
    (el) =>
      !ids.has(el.id) ||
      el.type !== 'shape' ||
      el.fillColor === undefined ||
      el.fillColor === 'transparent',
  );
}
