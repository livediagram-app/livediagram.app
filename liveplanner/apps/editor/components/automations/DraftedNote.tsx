'use client';

// The note above a drafted rule's steps (docs/specs/026-plan/automations.md "Describe a Rule"): the sparkle, Drafted
// by AI, and what to do before saving. The rule is unsaved and off until the person saves it.

import { AiNote } from './step-panels/AiStepPanel';

export function DraftedNote() {
  return (
    <div data-drafted-note="">
      <AiNote>
        <strong className="font-semibold">Drafted by AI.</strong> Check each step, then Test on a
        Card. Nothing is saved or turned on until you save it.
      </AiNote>
    </div>
  );
}
