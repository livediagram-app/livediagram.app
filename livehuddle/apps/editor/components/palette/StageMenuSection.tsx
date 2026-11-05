// The Stage's settings in the element menu (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage's way
// in"): Who Can Speak, as two tiles wearing the role pill's own glyphs, and Show Cameras, as a switch. Only an
// Editor's menu renders it (EditorContextMenuHost hands a Participant or a Viewer its own short menu).
import { useId } from 'react';
import {
  DEFAULT_STAGE_SPEAKERS,
  STAGE_SPEAKER_LABELS,
  STAGE_SPEAKERS,
  type ShapeElement,
  type StageSpeakers,
} from '@livehuddle/document';
import { lucideGlyph, PencilIcon } from '@livehuddle/ui';
import { lucideVote } from '@liveworkspace/icons/lucide';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';

export type StagePatch = { stageSpeakers?: StageSpeakers; stageCameras?: boolean };

// Editing's pencil and Participating's ballot, as the title bar's role pill draws them (RoleIndicator).
const VoteIcon = lucideGlyph(lucideVote, 14);
const SPEAKER_GLYPH: Record<StageSpeakers, React.ReactNode> = {
  edit: <PencilIcon size={14} />,
  'take-part': <VoteIcon />,
};

export function StageMenuSection({
  target,
  sectionProps,
  onSetStage,
}: {
  target: ShapeElement;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetStage: (patch: StagePatch) => void;
}) {
  const speakersLabelId = useId();
  const speakers = target.stageSpeakers ?? DEFAULT_STAGE_SPEAKERS;
  const cameras = target.stageCameras === true;
  return (
    <MenuAccordionSection title="Stage" icon={<ToolsMenuGlyph />} {...sectionProps('stage')}>
      <p
        id={speakersLabelId}
        className="px-2 pt-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
      >
        Who Can Speak
      </p>
      <div role="group" aria-labelledby={speakersLabelId}>
        <MenuTileGrid cols={2}>
          {STAGE_SPEAKERS.map((s) => (
            <MenuTile
              key={s}
              icon={SPEAKER_GLYPH[s]}
              label={STAGE_SPEAKER_LABELS[s]}
              active={speakers === s}
              onClick={() => onSetStage({ stageSpeakers: s })}
            />
          ))}
        </MenuTileGrid>
      </div>
      <p className="px-2 pb-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Who the whole tab hears from the stage. Anyone else standing on it is heard as the audience
        is.
      </p>
      <MenuToggleRow
        label="Show Cameras"
        description="Everyone on the tab sees a speaker's camera and screen"
        checked={cameras}
        onToggle={() => onSetStage({ stageCameras: !cameras })}
      />
    </MenuAccordionSection>
  );
}
