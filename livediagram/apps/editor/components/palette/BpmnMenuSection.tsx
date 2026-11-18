'use client';

import {
  BPMN_DATA_OBJECT_GEOMETRY,
  BPMN_FAMILY_SYMBOLS,
  BPMN_SYMBOL_LABELS,
  bpmnFamilyOf,
  bpmnMarkParts,
  withBpmnSymbol,
  type BpmnFamily,
  type BpmnSymbol,
} from '@livediagram/document';
import { Glyph } from '@livediagram/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import type { ElementStyleOps } from '@/lib/element-style-ops';

// The preview box each family's tile draws its symbol in, in element px: big enough that the mark sits as it does on
// a placed element (a task's marker in its corner), scaled down to the tile.
const PREVIEW: Readonly<Record<BpmnFamily, { w: number; h: number }>> = {
  event: { w: 48, h: 48 },
  gateway: { w: 56, h: 56 },
  task: { w: 80, h: 56 },
  data: { w: 48, h: 56 },
};

const FAMILY_TITLE: Readonly<Record<BpmnFamily, string>> = {
  event: 'Event',
  gateway: 'Gateway',
  task: 'Task',
  data: 'Data',
};

// The symbol's silhouette in its preview box: a circle, a rounded box, a diamond, a folded page or a cylinder.
function Body({ symbol, w, h }: { symbol: BpmnSymbol; w: number; h: number }) {
  const line = { fill: 'none' } as const;
  switch (bpmnFamilyOf(symbol)) {
    case 'event':
      return <circle cx={w / 2} cy={h / 2} r={w / 2 - 1.5} {...line} />;
    case 'gateway':
      return (
        <path
          d={`M ${w / 2} 1.5 L ${w - 1.5} ${h / 2} L ${w / 2} ${h - 1.5} L 1.5 ${h / 2} Z`}
          {...line}
        />
      );
    case 'task':
      return <rect x={1.5} y={1.5} width={w - 3} height={h - 3} rx={9} {...line} />;
    case 'data':
      return symbol === 'data-store' ? (
        <path
          d={`M 4 10 L 4 ${h - 10} A ${w / 2 - 4} 8 0 0 0 ${w - 4} ${h - 10} L ${w - 4} 10 A ${w / 2 - 4} 8 0 0 0 4 10 A ${w / 2 - 4} 8 0 0 0 ${w - 4} 10`}
          {...line}
        />
      ) : (
        <g transform={`translate(4 2) scale(${(w - 8) / 100} ${(h - 4) / 100})`}>
          {BPMN_DATA_OBJECT_GEOMETRY.parts.map((part, i) =>
            part.tag === 'path' ? <path key={i} d={part.d} {...line} /> : null,
          )}
        </g>
      );
  }
}

// An end event's heavy ring is a wide part over the body: kept heavy in the tile, or End reads as Start.
const HEAVY_PART = 3;
const HEAVY_STROKE_PX = 2.5;

// A tile's picture: the silhouette with the symbol's mark, drawn from the same parts the canvas and export draw, in
// the chrome icon weight (Glyph strokes do not scale), a heavy ring heavier.
function SymbolPreview({ symbol }: { symbol: BpmnSymbol }) {
  const { w, h } = PREVIEW[bpmnFamilyOf(symbol)];
  const units = Math.max(w, h);
  const heavyRing = bpmnFamilyOf(symbol) === 'event';
  return (
    <Glyph size={22} units={units}>
      <g transform={`translate(${(units - w) / 2} ${(units - h) / 2})`}>
        <Body symbol={symbol} w={w} h={h} />
        {bpmnMarkParts(symbol, w, h)
          .filter((part) => part.paint !== 'knock')
          .map((part, i) => (
            <path
              key={i}
              d={part.d}
              fill={part.paint === 'ink' ? 'currentColor' : 'none'}
              stroke={part.paint === 'ink' ? 'none' : undefined}
              strokeWidth={heavyRing && part.width >= HEAVY_PART ? HEAVY_STROKE_PX : undefined}
            />
          ))}
      </g>
    </Glyph>
  );
}

// A BPMN element's section (docs/specs/009-elements/bpmn.md "Changing the symbol"): a tile per symbol of its family,
// the current one pressed; hovering one previews it, a press changes it in one history step.
export function BpmnMenuSection({
  symbol,
  ops,
  sectionProps,
}: {
  symbol: BpmnSymbol;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  const family = bpmnFamilyOf(symbol);
  const options = BPMN_FAMILY_SYMBOLS[family];
  return (
    <MenuAccordionSection title="BPMN" icon={<DataMenuGlyph />} {...sectionProps('bpmn')}>
      <div className="px-2 pb-1">
        <BorderGrid label={FAMILY_TITLE[family]} cols={options.length <= 2 ? 2 : 4}>
          {options.map((v) => (
            <SizeButton
              key={v}
              active={symbol === v}
              label={BPMN_SYMBOL_LABELS[v]}
              onClick={() => ops.commit((el) => withBpmnSymbol(el, v), 'Bpmn')}
              onPointerEnter={onMouseHover(() => ops.preview((el) => withBpmnSymbol(el, v)))}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <SymbolPreview symbol={v} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
    </MenuAccordionSection>
  );
}
