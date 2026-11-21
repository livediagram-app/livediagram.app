'use client';

// The note above a drafted rule's steps (liveplanner/docs/specs/026-plan/automations.md "Describe a Rule"): Drafted
// by AI, check it, nothing is saved until you save.

import { AiNote } from './AiNote';
import { useAutomationsKit } from './kit-context';

export function DraftedNote() {
  const { test } = useAutomationsKit().plumbing.words;
  return (
    <div data-drafted-note="">
      <AiNote>
        <strong className="font-semibold">Drafted by AI.</strong> Check each step, then {test}.
        Nothing is saved or turned on until you save it.
      </AiNote>
    </div>
  );
}
