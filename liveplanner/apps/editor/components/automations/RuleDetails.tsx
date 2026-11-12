'use client';

// Rule Details (docs/specs/026-plan/automations.md "The rule builder"): an accordion, closed to start, holding Let
// this rule's changes trigger other rules and the line on whose access a rule runs with. On a phone (`placement="foot"`)
// it is a bar pinned in the rule drawer's foot, its body opening upward over the steps and scrolling when tall
// ("The rule builder on a phone").

import { useState } from 'react';
import { SwitchRow } from '@liveplanner/ui';
import { AccordionSection } from '@liveworkspace/workbench/components/primitives/AccordionSection';

export function RuleDetails({
  chain,
  onChain,
  placement = 'inline',
}: {
  chain: boolean;
  onChain: (next: boolean) => void;
  placement?: 'inline' | 'foot';
}) {
  const [open, setOpen] = useState(false);
  const foot = placement === 'foot';
  return (
    <div
      data-rule-details={placement}
      className={
        foot
          ? 'px-4 [&>div]:flex [&>div]:flex-col-reverse'
          : 'rounded-xl border border-slate-200 px-4 dark:border-slate-700'
      }
    >
      <AccordionSection
        title="Rule Details"
        open={open}
        onToggle={() => setOpen((v) => !v)}
        headerClassName={`flex w-full cursor-pointer items-center justify-between text-left ${foot ? 'h-11' : 'py-3'}`}
        titleClassName="text-[13px] font-semibold text-slate-800 dark:text-slate-100"
        bodyClassName={`flex flex-col gap-3 ${foot ? 'max-h-[40dvh] overflow-y-auto overscroll-contain pb-2 pt-3' : 'pb-4'}`}
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
