'use client';

// Publish as Roadmap… in the tab menu (docs/specs/026-plan/public-roadmap.md "Where it lives"), beside Subscribe to
// Calendar. Drawn only with the door RoadmapHost sets for someone who may publish, on a tab holding a Plan board.
import { lucideGlyph } from '@liveplanner/ui';
import { lucideMegaphone } from '@liveworkspace/icons/lucide';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useRoadmapDoor } from './RoadmapContext';

const RoadmapIcon = lucideGlyph(lucideMegaphone, 16);

export function RoadmapMenuRow({ onClose }: { onClose: () => void }) {
  const door = useRoadmapDoor();
  if (!door) return null;
  return (
    <MenuActionRow
      plain
      icon={<RoadmapIcon />}
      label="Publish as Roadmap…"
      onClick={() => {
        onClose();
        door.open();
      }}
    />
  );
}
