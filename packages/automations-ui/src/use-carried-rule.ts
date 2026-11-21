'use client';

// Crossing the phone breakpoint moves the builder between the dialog and the phone's drawer, which mounts it afresh
// ("The rule builder on a phone"). The rule as it stood (its unsaved changes, its open step) is carried across: read
// as the switch renders, while the old builder still holds it, and handed to the new one as the rule to resume.

import { useState, type RefObject } from 'react';
import type { AutomationsTarget } from './AutomationsContext';
import type { KeptRule } from './kit-context';

/** The rule the builder should open as it was left: one kept for Back to Rule, else one carried across a switch. */
export function useCarriedRule(
  phone: boolean,
  target: AutomationsTarget,
  builderDraft: RefObject<KeptRule | null>,
): KeptRule | undefined {
  const [layout, setLayout] = useState(phone);
  const [carried, setCarried] = useState<{ for: AutomationsTarget; kept: KeptRule } | null>(null);
  const editing = target.view === 'rule' ? target : null;
  if (layout !== phone) {
    setLayout(phone);
    const kept = builderDraft.current;
    // Onto a phone the step's sheet stays shut (the rule opens on its sentence); onto a wide screen, on the step.
    setCarried(
      editing && kept && kept.ruleId === (editing.ruleId ?? null)
        ? { for: target, kept: phone ? { ...kept, part: null } : kept }
        : null,
    );
  }
  if (!editing) return undefined;
  return editing.kept ?? (carried?.for === target ? carried.kept : undefined);
}
