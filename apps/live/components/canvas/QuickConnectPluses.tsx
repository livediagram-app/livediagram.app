import type { PointerEvent as ReactPointerEvent } from 'react';
import { canAppendWebRow, isRailShape, type Element } from '@livediagram/document';
import type { QuickConnectDirection, QuickConnectKind } from '@/lib/canvas';
import { QuickConnectRing } from '@/components/canvas/QuickConnectRing';
import { useMindGrow } from '@/components/canvas/MindGrowContext';

type Bounds = { x: number; y: number; width: number; height: number };

// The ring action each row-carrying web component offers (docs/specs/009-elements/web-components-and-no-groups.md).
const WEB_ROW_ACTION: Partial<Record<string, { label: string; description: string }>> = {
  'stat-row': { label: 'Add Stat', description: 'Add another KPI card to the row.' },
  process: { label: 'Add Step', description: 'Add another step to the end of the process.' },
  'site-header': { label: 'Add Link', description: 'Add another link to the header.' },
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
  onStartPencil,
  onAddRailPoint,
  onAddTableRow,
  onAddTableColumn,
  onAppendWebRow,
}: {
  selectedElement: Element | undefined;
  bounds: Bounds;
  zoom: number;
  // Which ring is open (lifted to Canvas so only one opens at a time). null = all closed.
  quickRingOpen: QuickConnectDirection | null;
  setQuickRingOpen: (placement: QuickConnectDirection | null) => void;
  openOnHover: boolean;
  onSpawnConnect: (direction: QuickConnectDirection, kind: QuickConnectKind) => void;
  onStartArrow: (direction: QuickConnectDirection, e: ReactPointerEvent) => void;
  onStartPencil: () => void;
  onAddRailPoint: () => void;
  onAddTableRow: () => void;
  onAddTableColumn: () => void;
  onAppendWebRow?: (elementId: string) => void;
}) {
  const growMind = useMindGrow();
  // A timeline rail's "+" gains "Add Point" (docs/specs/009-elements/timeline-rail.md).
  const selectedIsRail = selectedElement?.type === 'shape' && isRailShape(selectedElement.shape);
  const selectedIsTable = selectedElement?.type === 'table';
  const selectedIsMind = selectedElement?.type === 'shape' && selectedElement.shape === 'mind-node';
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
          onPencil={onStartPencil}
          onAddRailPoint={selectedIsRail ? onAddRailPoint : undefined}
          webRow={webRow}
          // Table ring (docs/specs/008-canvas/canvas-and-palette.md): Arrow + this side's structural add.
          variant={selectedIsTable ? 'table' : 'default'}
          onAddTableRow={selectedIsTable && placement === 'below' ? onAddTableRow : undefined}
          onAddTableColumn={selectedIsTable && placement === 'right' ? onAddTableColumn : undefined}
          // Mind map (docs/specs/009-elements/mind-node.md): Add child / Add sibling, each naming its
          // shortcut in the hover card. Only on a mind node, and only where there is a grower (not
          // the share view, embed, or exports).
          onGrowMind={
            selectedIsMind && growMind
              ? (relation) => growMind.grow(selectedElement.id, relation)
              : undefined
          }
        />
      ))}
    </>
  );
}
