'use client';

import { withSequenceNumbered, type ShapeElement } from '@livehuddle/document';
import { Button } from '@livehuddle/ui';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { MenuToggleRow } from '@/components/palette/context-menu-rows';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

// A sequence diagram's section (docs/specs/009-elements/sequence-diagram.md "The menu"): what it holds, Edit Sequence
// (the dialog, where its participants and messages are written; too much for a menu) and Numbered. Play is a category
// of the menu's Animation row (ElementAnimationTiles).
export function SequenceMenuSection({
  target,
  ops,
  sectionProps,
  onEdit,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
  // Opens the Sequence dialog; absent when this session may not edit the diagram.
  onEdit?: (elementId: string) => void;
}) {
  const people = target.sequenceParticipants?.length ?? 0;
  const messages = target.sequenceMessages?.length ?? 0;

  return (
    <MenuAccordionSection title="Sequence" icon={<DataMenuGlyph />} {...sectionProps('sequence')}>
      <div className="px-2 py-1.5">
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          {plural(people, 'participant')} · {plural(messages, 'message')}
        </p>
        {onEdit ? (
          <Button
            variant="secondary"
            size="xs"
            className="mt-1.5 w-full"
            onClick={() => onEdit(target.id)}
          >
            Edit Sequence
          </Button>
        ) : null}
      </div>
      <MenuToggleRow
        label="Numbered"
        checked={target.sequenceNumbered === true}
        onToggle={() =>
          ops.commit((el) => withSequenceNumbered(el, !target.sequenceNumbered), 'SequenceNumbered')
        }
      />
    </MenuAccordionSection>
  );
}
