'use client';

// A template tile's picture, composed (blueprint item-ui.md "Pictures"): the template's trigger's vignette, a line
// running on from it, and its last step's vignette, on stage 3's TemplateScene frame in the template's colour. The
// step's half plays a beat after the trigger's (.ats-late). An app hands a hand-drawn vignette in place of the pair
// for a template it wants its own picture for. Decoration only.

import type { ReactNode } from 'react';
import { TemplateScene } from '../../TemplateScene';
import type { SceneTone, ToneClasses } from '../../tile-picker/tile-scene';
import type { ItemVignette } from '../types';
import { FlowLine } from './scene-bits';

/** A template's two halves side by side: what starts it, and what it ends by doing. */
export function TemplatePair({
  tone,
  trigger,
  step,
}: {
  tone: ToneClasses;
  trigger: ItemVignette;
  // None: a template with no step yet draws its trigger alone.
  step: ItemVignette | null;
}): ReactNode {
  const half = 'relative flex min-w-0 flex-1 items-center justify-center gap-1.5';
  return (
    <span data-template-pair="" className="relative flex min-w-0 flex-1 items-center gap-1">
      <span data-template-half="trigger" className={half}>
        {trigger({ tone })}
      </span>
      {step ? (
        <>
          <FlowLine tone={tone} className="w-3" />
          <span data-template-half="step" className={`ats-late ${half}`}>
            {step({ tone })}
          </span>
        </>
      ) : null}
    </span>
  );
}

export function ItemTemplateScene({
  tone,
  trigger,
  step,
  scene,
}: {
  tone: SceneTone;
  trigger: ItemVignette;
  step: ItemVignette | null;
  /** The app's own picture for this template, in place of the pair. */
  scene?: ItemVignette | undefined;
}) {
  return (
    <TemplateScene
      tone={tone}
      Scene={({ tone: t }) =>
        scene ? scene({ tone: t }) : <TemplatePair tone={t} trigger={trigger} step={step} />
      }
    />
  );
}
