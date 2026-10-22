import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  canAppendWebRow,
  isEntity,
  isFlowchartStep,
  type Element,
  type Rect,
} from '@livepages/document';
import type { QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import { QuickConnectRing } from '@/components/canvas/QuickConnectRing';
import { useMindGrow } from '@/components/canvas/MindGrowContext';

// The ring action each row-carrying web component offers (docs/specs/009-elements/web-components-and-no-groups.md).
const WEB_ROW_ACTION: Partial<Record<string, { label: string; description: string }>> = {
  'stat-row': { label: 'Add Stat', description: 'Add another KPI card to the row.' },
  process: { label: 'Add Step', description: 'Add another step to the end of the process.' },
  'site-header': { label: 'Add Link', description: 'Add another link to the header.' },
  card: { label: 'Add Tag', description: 'Add a tag chip along the bottom of the card.' },
  // Concept graphics (docs/specs/009-elements/concept-graphics.md).
  'layer-stack': {
    label: 'Add Layer',
    description: 'Add another layer to the bottom of the stack.',
  },
  pyramid: { label: 'Add Tier', description: 'Add another tier to the pyramid.' },
  cycle: { label: 'Add Step', description: 'Add another step to the cycle.' },
  hub: { label: 'Add Satellite', description: 'Add another satellite round the hub.' },
  onion: { label: 'Add Ring', description: 'Add another ring round the outside.' },
  chevrons: { label: 'Add Stage', description: 'Add another stage to the end.' },
  // Missing until October 2026, so a timeline's ring offered no Add Milestone (concept-graphics.md promises one).
  'timeline-rail': { label: 'Add Milestone', description: 'Add another milestone to the end.' },
};

// The four quick-connect "+" buttons around a single selected element (docs/specs/008-canvas/canvas-and-palette.md),
// one per side, each opening its ring. Drawn in the canvas grips layer, above every element.
export function QuickConnectPluses({
  selectedElement,
  bounds,
  zoom,
  quickRingOpen,
  setQuickRingOpen,
  openOnHover,
  onSpawnConnect,
  onStartArrow,
  onAddTableRow,
  onAddTableColumn,
  onAppendWebRow,
  onAddEntityField,
  onAddRelatedEntity,
}: {
  selectedElement: Element | undefined;
  bounds: Rect;
  zoom: number;
  // Which ring is open (lifted to Canvas so only one opens at a time). null = all closed.
  quickRingOpen: QuickConnectDirection | null;
  setQuickRingOpen: (placement: QuickConnectDirection | null) => void;
  openOnHover: boolean;
  onSpawnConnect: (direction: QuickConnectDirection, kind: QuickConnectKind) => void;
  onStartArrow: (direction: QuickConnectDirection, e: ReactPointerEvent) => void;
  onAddTableRow: () => void;
  onAddTableColumn: () => void;
  onAppendWebRow?: (elementId: string) => void;
  // Entities (docs/specs/009-elements/entity.md "Growing a model"): Add Field and Add Related Entity.
  onAddEntityField?: () => void;
  onAddRelatedEntity?: (side: QuickConnectDirection) => void;
}) {
  const growMind = useMindGrow();
  const selectedIsTable = selectedElement?.type === 'table';
  const selectedIsMind = selectedElement?.type === 'shape' && selectedElement.shape === 'mind-node';
  const selectedIsStep = !!selectedElement && isFlowchartStep(selectedElement);
  const selectedIsEntity = isEntity(selectedElement) && !selectedElement.locked;
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md): the ring's "Add stat / step / link", while
  // there is room for one more.
  const webRow =
    selectedElement?.type === 'shape' && onAppendWebRow && canAppendWebRow(selectedElement)
      ? {
          ...WEB_ROW_ACTION[selectedElement.shape]!,
          onAdd: () => onAppendWebRow(selectedElement.id),
        }
      : undefined;
  const sides = [
    { placement: 'right', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
    { placement: 'below', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
    { placement: 'left', x: bounds.x, y: bounds.y + bounds.height / 2 },
    { placement: 'above', x: bounds.x + bounds.width / 2, y: bounds.y },
  ] as const;
  return (
    <>
      {sides.map(({ placement, x, y }) => (
        <QuickConnectRing
          key={placement}
          x={x}
          y={y}
          placement={placement}
          zoom={zoom}
          open={quickRingOpen === placement}
          openOnHover={openOnHover}
          onToggle={() => setQuickRingOpen(quickRingOpen === placement ? null : placement)}
          onOpen={() => setQuickRingOpen(placement)}
          onClose={() => setQuickRingOpen(null)}
          onSpawn={(kind) => onSpawnConnect(placement, kind)}
          onArrowPointerDown={(e) => onStartArrow(placement, e)}
          webRow={webRow}
          // Table ring (docs/specs/008-canvas/canvas-and-palette.md): Arrow + this side's structural add.
          variant={selectedIsTable ? 'table' : 'default'}
          onAddTableRow={selectedIsTable && placement === 'below' ? onAddTableRow : undefined}
          onAddTableColumn={selectedIsTable && placement === 'right' ? onAddTableColumn : undefined}
          // Mind map (docs/specs/009-elements/mind-node.md): Add child / Add sibling, each naming its
          // shortcut in the hover card. Only on a mind node, and only where there is a grower (not
          // the share view, embed, or exports).
          // A flowchart step grows the same way (docs/specs/009-elements/flowchart.md): Add Step / Add Branch.
          onGrowMind={
            (selectedIsMind || selectedIsStep) && growMind
              ? (relation) => growMind.grow(selectedElement.id, relation)
              : undefined
          }
          growing={selectedIsStep ? 'flowchart' : 'mind'}
          // An entity's ring (docs/specs/009-elements/entity.md): Add Related Entity on every side, Add
          // Field on the bottom one.
          entity={
            selectedIsEntity && onAddRelatedEntity
              ? {
                  onAddRelated: () => onAddRelatedEntity(placement),
                  onAddField: placement === 'below' ? onAddEntityField : undefined,
                }
              : undefined
          }
        />
      ))}
    </>
  );
}
