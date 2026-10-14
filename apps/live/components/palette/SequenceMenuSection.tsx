'use client';

import {
  DEFAULT_ANIMATION_SPEED,
  withSequenceAnim,
  withSequenceNumbered,
  type ShapeElement,
} from '@livediagram/document';
import { Button, Glyph } from '@livediagram/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid, MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  SpeedAndRepeatRows,
  TileLabel,
  useSpeedRowGate,
} from '@/components/palette/context-menu-tiles';
import type { ElementStyleOps } from '@/lib/element-style-ops';

function PlayIcon({ on }: { on: boolean }) {
  return (
    <Glyph size={16} units={18}>
      {on ? <path d="M3 4h12M3 9h9M3 14h6" /> : <path d="M4 14 14 4" />}
    </Glyph>
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

// A sequence diagram's section (docs/specs/009-elements/sequence-diagram.md "The menu"): what it holds, Edit Sequence
// (the dialog, where its participants and messages are written; too much for a menu), Numbered and Play.
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
  const play = target.sequenceAnim === 'play' ? ('play' as const) : null;
  const { showSpeed, handleSet } = useSpeedRowGate<'play'>(play, (v) =>
    ops.commit((el) => withSequenceAnim(el, { anim: v }), 'SequenceAnim'),
  );
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
      <div className="px-2 pb-1">
        <BorderGrid label="Animation" cols={4}>
          {([null, 'play'] as const).map((v) => (
            <SizeButton
              key={v ?? 'none'}
              active={play === v}
              label={v ? 'Play Animation' : 'None Animation'}
              onClick={() => handleSet(v)}
            >
              <TileLabel glyph={<PlayIcon on={!!v} />} label={v ? 'Play' : 'None'} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      {showSpeed ? (
        <SpeedAndRepeatRows
          speed={target.sequenceAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
          repeat={target.sequenceAnimRepeat === true}
          onSetSpeed={(speed) =>
            ops.commit((el) => withSequenceAnim(el, { speed }), 'SequenceAnim')
          }
          onSetRepeat={(repeat) =>
            ops.commit((el) => withSequenceAnim(el, { repeat }), 'SequenceAnim')
          }
        />
      ) : null}
    </MenuAccordionSection>
  );
}
