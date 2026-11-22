'use client';

// An AI step's source line (liveworkspace/docs/specs/018-automations/automations.md "AI"): a rule's run has no
// person's request behind it, so its AI steps always run on built-in AI, never on a key (ai-keys.md "Which key
// wins"). The shared line says so, with the item's daily allowance, and offers no action: no key would change it.

import { AUTOMATION_AI_PER_DAY } from '@liveworkspace/automations';
import { AiSource } from '@liveworkspace/settings-ui/ai-source';

const BUILT_IN = { kind: 'built-in', canChange: false } as const;

export function AiStepSource({ item, extra }: { item: string; extra?: string }) {
  return (
    <AiSource
      line={BUILT_IN}
      allowance={`Rules run on built-in AI: counts toward this ${item}’s ${AUTOMATION_AI_PER_DAY} AI steps a day.${extra ? ` ${extra}` : ''}`}
    />
  );
}
