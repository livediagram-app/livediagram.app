'use client';

// A For Related Cards branch's lines on the Audit Trail (docs/specs/026-plan/automations.md "The Automations
// screen": Audit Trail): the related cards' own lines sit under the branch's, each naming its card ("#14 Moved to
// Done"), the card's number in bold. The platform's run steps draw them where the kit says (kit.audit.inset).

import type { ReactNode } from 'react';
import type { AutomationStepLine } from '@liveplanner/items';
import { goneText } from './needs-words';

// A related card's line names its card first: "#14 Moved to Done".
const RELATED = /^(#\d+) (.*)$/s;

/** Which lines sit under a branch: the related cards' own, from the branch's line until one that names no card. */
export function insetLines(steps: readonly AutomationStepLine[]): boolean[] {
  const out: boolean[] = [];
  let inBranch = false;
  for (const line of steps) {
    if (line.kind === 'branch') inBranch = true;
    else inBranch = inBranch && line.kind !== 'trigger' && RELATED.test(line.text);
    out.push(line.kind !== 'branch' && inBranch);
  }
  return out;
}

// A related card's line: its card's number in bold.
function RelatedText({ text }: { text: string }) {
  const [, key = '', rest = text] = RELATED.exec(text) ?? [];
  return (
    <>
      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{key}</span>{' '}
      {rest}
    </>
  );
}

const lineText = (line: AutomationStepLine) =>
  line.kind === 'action' || line.kind === 'condition' ? goneText(line.text, line.gone) : line.text;

/** Each line's inset reading, or null for a line drawn as it is. */
export const insetRunLines = (steps: readonly AutomationStepLine[]): (ReactNode | null)[] => {
  const inset = insetLines(steps);
  return steps.map((line, i) => (inset[i] ? <RelatedText text={lineText(line)} /> : null));
};
