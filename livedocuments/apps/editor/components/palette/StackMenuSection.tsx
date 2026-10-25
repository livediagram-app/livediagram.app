'use client';

import {
  STACK_ALIGNS,
  STACK_COLUMNS_MAX,
  STACK_COLUMNS_MIN,
  STACK_DIRECTIONS,
  STACK_SPACING_MAX,
  stackSettingsOf,
  withStackSettings,
  type ShapeElement,
  type StackAlign,
  type StackDirection,
} from '@livedocuments/document';
import { Glyph } from '@livedocuments/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import { PreviewSliderRow } from '@/components/primitives/PreviewSliderRow';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const DIRECTION_LABEL: Record<StackDirection, string> = {
  row: 'Row Stack',
  column: 'Column Stack',
  grid: 'Grid Stack',
};
const ALIGN_LABEL: Record<StackAlign, string> = {
  start: 'Align Start',
  center: 'Align Centre',
  end: 'Align End',
};

function DirectionIcon({ d }: { d: StackDirection }) {
  return (
    <Glyph size={18} units={18}>
      {d === 'row' ? <path d="M2 6h4v6H2zM7 6h4v6H7zM12 6h4v6h-4z" /> : null}
      {d === 'column' ? <path d="M5 2h8v4H5zM5 7h8v4H5zM5 12h8v4H5z" /> : null}
      {d === 'grid' ? <path d="M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z" /> : null}
    </Glyph>
  );
}

function AlignIcon({ a }: { a: StackAlign }) {
  const y = a === 'start' ? 3 : a === 'center' ? 6.5 : 10;
  return (
    <Glyph size={18} units={18}>
      <path d="M2 3h14M2 15h14" strokeOpacity={0.4} />
      <rect x="4" y={y} width="4" height="5" />
      <rect x="10" y={y} width="4" height="5" />
    </Glyph>
  );
}

// A stack's section (docs/specs/009-elements/stack.md "Menu"): its arrangement, the grid's columns, gap, padding and
// alignment, each through the menu's generic style ops so a pick (or a slider drag) is one undo step.
export function StackMenuSection({
  target,
  ops,
  sectionProps,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  const s = stackSettingsOf(target);
  return (
    <MenuAccordionSection title="Stack" icon={<DataMenuGlyph />} {...sectionProps('stack')}>
      <div className="px-2 pb-1">
        <BorderGrid label="Arrange" cols={3}>
          {STACK_DIRECTIONS.map((d) => (
            <SizeButton
              key={d}
              active={s.direction === d}
              label={DIRECTION_LABEL[d]}
              onClick={() =>
                ops.commit((el) => withStackSettings(el, { direction: d }), 'StackDirection')
              }
              onPointerEnter={onMouseHover(() =>
                ops.preview((el) => withStackSettings(el, { direction: d })),
              )}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <DirectionIcon d={d} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      {s.direction === 'grid' ? (
        <PreviewSliderRow
          label="Columns"
          min={STACK_COLUMNS_MIN}
          max={STACK_COLUMNS_MAX}
          step={1}
          value={s.columns}
          format={(v) => String(v)}
          onPreview={(v) => ops.preview((el) => withStackSettings(el, { columns: v }))}
          onCommit={(v) =>
            ops.commit((el) => withStackSettings(el, { columns: v }), 'StackColumns')
          }
          onPreviewEnd={ops.end}
        />
      ) : null}
      <PreviewSliderRow
        label="Gap"
        min={0}
        max={STACK_SPACING_MAX}
        step={4}
        value={s.gap}
        format={(v) => `${v}px`}
        onPreview={(v) => ops.preview((el) => withStackSettings(el, { gap: v }))}
        onCommit={(v) => ops.commit((el) => withStackSettings(el, { gap: v }), 'StackGap')}
        onPreviewEnd={ops.end}
      />
      <PreviewSliderRow
        label="Padding"
        min={0}
        max={STACK_SPACING_MAX}
        step={4}
        value={s.padding}
        format={(v) => `${v}px`}
        onPreview={(v) => ops.preview((el) => withStackSettings(el, { padding: v }))}
        onCommit={(v) => ops.commit((el) => withStackSettings(el, { padding: v }), 'StackPadding')}
        onPreviewEnd={ops.end}
      />
      <div className="px-2 pb-1">
        <BorderGrid label="Align" cols={3}>
          {STACK_ALIGNS.map((a) => (
            <SizeButton
              key={a}
              active={s.align === a}
              label={ALIGN_LABEL[a]}
              onClick={() => ops.commit((el) => withStackSettings(el, { align: a }), 'StackAlign')}
              onPointerEnter={onMouseHover(() =>
                ops.preview((el) => withStackSettings(el, { align: a })),
              )}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <AlignIcon a={a} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
    </MenuAccordionSection>
  );
}
