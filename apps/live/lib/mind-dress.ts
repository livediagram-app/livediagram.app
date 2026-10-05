// How a new mind node and its connector look (docs/specs/009-elements/mind-node.md "A new node
// looks like its level"): the tab's theme like any new element, then its level's look on top; the
// connector a sibling's look, else the mind connector defaults. Shared by growth from the keyboard
// (useMindGrowth) and an outline save (useMindOutline), so the two never dress a node differently.
import {
  MIND_CONNECTOR_LOOK,
  type ArrowElement,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { paintableArrowFields, paintableBoxedFields } from '@/lib/format-painter';
import { deriveNewBoxedColours } from '@/lib/themes';

/** A new mind node in the tab's theme, then in `styleFrom`'s look (null: the theme's alone). */
export function dressMindNode(
  node: ShapeElement,
  styleFrom: ShapeElement | null,
  tab: Pick<Tab, 'backgroundColor' | 'patternColor' | 'theme' | 'defaultTextSize'>,
): ShapeElement {
  const themed: ShapeElement = {
    ...node,
    ...deriveNewBoxedColours(node, {
      backgroundColor: tab.backgroundColor,
      patternColor: tab.patternColor,
      theme: tab.theme,
    }),
    ...(tab.defaultTextSize ? { textSize: tab.defaultTextSize } : {}),
  };
  if (!styleFrom) return themed;
  return { ...themed, ...(paintableBoxedFields(styleFrom) as Partial<ShapeElement>) };
}

/** A new mind connector in `from`'s look, else the mind connector defaults. */
export function dressMindConnector(arrow: ArrowElement, from: ArrowElement | null): ArrowElement {
  return { ...arrow, ...(from ? paintableArrowFields(from) : MIND_CONNECTOR_LOOK) };
}
