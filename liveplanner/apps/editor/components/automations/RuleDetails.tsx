'use client';

// Rule Details (docs/specs/026-plan/automations.md "The rule builder"): an accordion, closed to start, holding Let
// this rule's changes trigger other rules and the line on whose access a rule runs with.

import { useState } from 'react';
import { SwitchRow } from '@liveplanner/ui';
import { AccordionSection } from '@liveworkspace/workbench/components/primitives/AccordionSection';

export function RuleDetails({
  chain,
  onChain,
}: {
  chain: boolean;
  onChain: (next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-rule-details=""
      className="rounded-xl border border-slate-200 px-4 dark:border-slate-700"
    >
      <AccordionSection
        title="Rule Details"
        open={open}
        onToggle={() => setOpen((v) => !v)}
        headerClassName="flex w-full items-center justify-between py-3 text-left"
        titleClassName="text-[13px] font-semibold text-slate-800 dark:text-slate-100"
        bodyClassName="flex flex-col gap-3 pb-4"
      >
        <SwitchRow
          checked={chain}
          onChange={onChain}
          layout="flex items-start justify-between gap-3 text-left"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
              Let this rule’s changes trigger other rules
            </span>
            <span className="text-[12px] text-slate-500 dark:text-slate-400">
              Off keeps rules from setting each other off. Chains stop after 5 rules.
            </span>
          </span>
        </SwitchRow>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          Runs as{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">Automation</span>, with
          an Editor’s access, for changes anyone with edit or participate access makes.
        </p>
      </AccordionSection>
    </div>
  );
}
