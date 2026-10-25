'use client';

import { detachChip, type ShapeElement } from '@liveplanner/project';
import {
  MenuAccordionSection,
  MenuActionButton,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import type { ElementStyleOps } from '@/lib/element-style-ops';

// A pointer note's section (docs/specs/009-elements/pointer-note.md "Menu"): Detach while its tip is attached; with
// a free tip there is nothing to do here, so it says how to point it.
export function PointerNoteMenuSection({
  target,
  ops,
  sectionProps,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  return (
    <MenuAccordionSection
      title="Pointer Note"
      icon={<DataMenuGlyph />}
      {...sectionProps('pointer-note')}
    >
      <div className="flex flex-col gap-1 px-2 pb-1.5 pt-1">
        {target.attachedTo ? (
          <MenuActionButton
            label="Detach"
            onClick={() => ops.commit((el) => detachChip(el), 'PointerDetach')}
          />
        ) : (
          <p className="px-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Drag the dot at the end of the line onto a corner or edge of a shape to pin it there.
          </p>
        )}
      </div>
    </MenuAccordionSection>
  );
}
