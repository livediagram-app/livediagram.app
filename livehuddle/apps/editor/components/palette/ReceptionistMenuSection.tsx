// The Receptionist in his Avatar Pad's element menu (docs/specs/008-canvas/receptionist.md "Asking him to leave"):
// one switch, on while he is there, which brings him back after an Editor asked him to leave. Only an Editor's menu
// renders it (EditorContextMenuHost hands a Participant or a Viewer its own short menu), and only on the tab's
// first pad, his.
import type { ShapeElement } from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';

export function ReceptionistMenuSection({
  target,
  sectionProps,
  onSetHere,
}: {
  target: ShapeElement;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetHere: (here: boolean) => void;
}) {
  const here = target.receptionistLeft !== true;
  return (
    <MenuAccordionSection
      title="Receptionist"
      icon={<ToolsMenuGlyph />}
      {...sectionProps('receptionist')}
    >
      <MenuToggleRow
        label="Receptionist"
        description="Greets everyone who arrives on this pad and shows them around"
        checked={here}
        onToggle={() => onSetHere(!here)}
      />
    </MenuAccordionSection>
  );
}
