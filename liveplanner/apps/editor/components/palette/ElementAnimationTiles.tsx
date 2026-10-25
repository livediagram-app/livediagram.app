'use client';

import {
  DEFAULT_ANIMATION_SPEED,
  conceptAnimOf,
  conceptAnimRepeats,
  conceptAnimsFor,
  withConceptAnim,
  withSequenceAnim,
  type ConceptAnim,
  type ConceptShape,
  type ShapeElement,
} from '@liveplanner/project';
import { Glyph } from '@liveplanner/ui';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  SpeedAndRepeatRows,
  TileLabel,
  useSpeedRowGate,
  withNone,
} from '@/components/palette/context-menu-tiles';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import type { ElementStyleOps } from '@/lib/element-style-ops';

// The animations of the elements whose set is their own and written through the element-style ops: a concept
// graphic's Concept set (docs/specs/009-elements/concept-graphics.md "Animation") and a sequence diagram's Play
// (docs/specs/009-elements/sequence-diagram.md "Animation"). Shown as their categories in the menu's Animation row
// (AnimationSections), never in the element's own section. Each commit goes to the whole selection; the writers leave
// any other kind untouched.

const CONCEPT_LABEL: Record<ConceptAnim | 'none', string> = {
  none: 'None',
  build: 'Build',
  pulse: 'Pulse',
  flow: 'Flow',
};

function ConceptAnimIcon({ anim }: { anim: ConceptAnim | null }) {
  return (
    <Glyph size={16} units={18}>
      {anim === null ? <path d="M4 14 14 4" /> : null}
      {anim === 'build' ? <path d="M3 15h12M5 11h8M7 7h4" /> : null}
      {anim === 'pulse' ? <path d="M2 9h4l2-4 2 8 2-4h4" /> : null}
      {anim === 'flow' ? <path d="M14 6a6 6 0 1 0 1 5M14 2v4h-4" /> : null}
    </Glyph>
  );
}

/** A concept graphic's Build / Pulse / Flow with Speed and Repeat, read from `target`. */
export function ConceptAnimTiles({
  target,
  ops,
}: {
  target: ShapeElement & { shape: ConceptShape };
  ops: ElementStyleOps;
}) {
  const anim = conceptAnimOf(target);
  const { showSpeed, handleSet } = useSpeedRowGate<ConceptAnim>(anim, (v) =>
    ops.commit((el) => withConceptAnim(el, { anim: v }), 'ConceptAnim'),
  );
  return (
    <>
      <div className="px-2 pb-1">
        <BorderGrid label="Animation" cols={4}>
          {withNone(conceptAnimsFor(target.shape)).map((v) => (
            <SizeButton
              key={v ?? 'none'}
              active={anim === v}
              label={`${CONCEPT_LABEL[v ?? 'none']} Animation`}
              onClick={() => handleSet(v)}
              onPointerEnter={onMouseHover(() =>
                ops.preview((el) => withConceptAnim(el, { anim: v })),
              )}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <TileLabel glyph={<ConceptAnimIcon anim={v} />} label={CONCEPT_LABEL[v ?? 'none']} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      {showSpeed ? (
        <SpeedAndRepeatRows
          speed={target.conceptAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
          repeat={conceptAnimRepeats(target)}
          onSetSpeed={(speed) => ops.commit((el) => withConceptAnim(el, { speed }), 'ConceptAnim')}
          onSetRepeat={(repeat) =>
            ops.commit((el) => withConceptAnim(el, { repeat }), 'ConceptAnim')
          }
        />
      ) : null}
    </>
  );
}

function PlayIcon({ on }: { on: boolean }) {
  return (
    <Glyph size={16} units={18}>
      {on ? <path d="M3 4h12M3 9h9M3 14h6" /> : <path d="M4 14 14 4" />}
    </Glyph>
  );
}

/** A sequence diagram's None / Play with Speed and Repeat, read from `target`. */
export function SequenceAnimTiles({ target, ops }: { target: ShapeElement; ops: ElementStyleOps }) {
  const play = target.sequenceAnim === 'play' ? ('play' as const) : null;
  const { showSpeed, handleSet } = useSpeedRowGate<'play'>(play, (v) =>
    ops.commit((el) => withSequenceAnim(el, { anim: v }), 'SequenceAnim'),
  );
  return (
    <>
      <div className="px-2 pb-1">
        <BorderGrid label="Animation" cols={4}>
          {([null, 'play'] as const).map((v) => (
            <SizeButton
              key={v ?? 'none'}
              active={play === v}
              label={v ? 'Play Animation' : 'None Animation'}
              onClick={() => handleSet(v)}
              onPointerEnter={onMouseHover(() =>
                ops.preview((el) => withSequenceAnim(el, { anim: v })),
              )}
              onPointerLeave={onMouseHover(ops.end)}
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
    </>
  );
}
