import {
  cleanSankeyFlows,
  cleanSankeyName,
  isSankeyShape,
  pruneSankeyNodes,
  SANKEY_LEFTOVER_NAME,
  SANKEY_NAME_MAX,
  SANKEY_UNIT_MAX,
  withSankeyNodeColor,
  type Element,
  type SankeyFlow,
  type SankeyNodeStyle,
  type ShapeElement,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { makeShapePatcher } from '@/hooks/canvas/shape-patcher';

// The Sankey diagram's writes (docs/specs/009-elements/sankey.md "The menu", "The Flows dialog"). Each is one
// commit, so one undo step: a flows edit from the dialog, a node's colour, or one display option.
//
// The flows setter names its element rather than reading the selection: the dialog edits the diagram it was
// opened for, whatever happens to the selection behind it.

type SankeyPatch = Pick<
  ShapeElement,
  | 'sankeyLinkColor'
  | 'sankeyAlign'
  | 'sankeyValueLabel'
  | 'sankeyUnit'
  | 'sankeyLeftover'
  | 'sankeyLeftoverName'
  | 'sankeyAnim'
  | 'sankeyAnimSpeed'
  | 'sankeyAnimRepeat'
  | 'textSize'
>;

export function useSankeySetters({
  currentSelectionIds,
  commit,
}: {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
}) {
  const patchSelected = makeShapePatcher({ currentSelectionIds, commit, matches: isSankeyShape });

  // The whole flow list (and, after a rename, the node colours that moved with it) at once.
  const setSankeyFlows = (id: string, flows: SankeyFlow[], nodes?: SankeyNodeStyle[]) => {
    const clean = cleanSankeyFlows(flows);
    commit((els) =>
      els.map((el) =>
        el.id === id && el.type === 'shape' && isSankeyShape(el.shape)
          ? {
              ...el,
              sankeyFlows: clean,
              sankeyNodes: pruneSankeyNodes(nodes ?? el.sankeyNodes, clean),
            }
          : el,
      ),
    );
    track('Element', 'Changed', 'SankeyFlows');
  };

  // A node's colour on every selected diagram that has the node; `undefined` hands it back to the palette.
  const setSankeyNodeColorSelected = (name: string, color: string | undefined) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && isSankeyShape(el.shape)
          ? { ...el, sankeyNodes: withSankeyNodeColor(el.sankeyNodes, name, color) }
          : el,
      ),
    );
    track('Element', 'Changed', 'SankeyStyle');
  };

  // One display option. Animation fields report as SankeyAnim, everything else as SankeyStyle.
  const setSankeyOptionSelected = (patch: Partial<SankeyPatch>) => {
    const next = { ...patch };
    if ('sankeyUnit' in next) {
      const unit = next.sankeyUnit?.trim().slice(0, SANKEY_UNIT_MAX);
      next.sankeyUnit = unit ? unit : undefined;
    }
    if ('sankeyLeftoverName' in next) {
      const name = cleanSankeyName(next.sankeyLeftoverName ?? '').slice(0, SANKEY_NAME_MAX);
      next.sankeyLeftoverName = name && name !== SANKEY_LEFTOVER_NAME ? name : undefined;
    }
    const anim = 'sankeyAnim' in next || 'sankeyAnimSpeed' in next || 'sankeyAnimRepeat' in next;
    patchSelected(next, anim ? 'SankeyAnim' : 'SankeyStyle');
  };

  return { setSankeyFlows, setSankeyNodeColorSelected, setSankeyOptionSelected };
}

export type SankeySetters = ReturnType<typeof useSankeySetters>;
