'use client';

import { useEffect, useState } from 'react';
import { TOUR_GLIDE_MS } from './tour-motion';
import type { TourStepOf } from './tour-step';
import type { TourEngine } from './useTourEngine';

// What the tour's card says and whether it is mid-glide (docs/specs/007-editor/editor-tour.md "Motion"). The card keeps
// showing the step it last landed on while the next one prepares (its menu opening, its panel scrolling), so a step's
// words never sit beside the previous step's target; when the next step lands, its words come in as the ring and the
// card glide to it together. The glide is the only time either animates its position: a target that moves while its
// step is up (a scroll, a zoom) is followed exactly.
export function useTourGlide<Api>(engine: TourEngine<Api>) {
  // The last card lands like any step, centred: the card glides to the middle of the screen with its words.
  const landed = engine.active && engine.landed && engine.step ? engine.step : null;
  const [shown, setShown] = useState<{ step: TourStepOf<Api>; stepIndex: number } | null>(null);
  const [gliding, setGliding] = useState(false);
  // Adjusted during render: the landing and the words change in the same frame.
  if (landed && shown?.step.id !== landed.id) {
    setShown({ step: landed, stepIndex: engine.stepIndex });
    // The first step of a run arrives (the card fades in); every later one glides from the last.
    setGliding(shown !== null);
  }
  if (!engine.active && shown) setShown(null);
  useEffect(() => {
    if (!gliding) return;
    const t = setTimeout(() => setGliding(false), TOUR_GLIDE_MS + 40);
    return () => clearTimeout(t);
  }, [gliding, shown]);
  return { shown, gliding };
}
