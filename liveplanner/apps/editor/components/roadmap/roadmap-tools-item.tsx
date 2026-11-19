'use client';

// Publish Roadmap in the footer's Tools menu, in Collaborate (docs/specs/026-plan/public-roadmap.md "Where it lives";
// liveworkspace/docs/specs/004-index/footer-tools-menu.md): there only with the door RoadmapHost sets for someone who
// may publish, on a plan with a Plan board on any tab.
import { lucideGlyph } from '@liveplanner/ui';
import { lucideMegaphone } from '@liveworkspace/icons/lucide';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { useRoadmapDoor } from './RoadmapContext';

const RoadmapIcon = lucideGlyph(lucideMegaphone, 16);

export function useRoadmapToolsItem(): ChromeToolsItem | null {
  const door = useRoadmapDoor();
  if (!door) return null;
  return {
    id: 'roadmap',
    group: 'collaborate',
    label: 'Publish Roadmap',
    description: 'A public page of a board’s cards.',
    icon: <RoadmapIcon />,
    // Its dialog opens inside Tools (footer-tools-menu.md "Opening a tool inside Tools").
    inPlace: true,
    onSelect: () => door.open(),
  };
}
