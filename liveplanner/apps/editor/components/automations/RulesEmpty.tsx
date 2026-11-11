'use client';

// The Rules list with no rules (docs/specs/026-plan/automations.md "The Automations screen": Empty): the bolt, No
// Rules Yet, what a rule does, New Rule and How Rules Work. The shared EmptyState, so it reads as every other empty
// surface in the editor.

import { Button, EmptyState, PlusIcon } from '@liveplanner/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { BoltIcon } from './automation-glyphs';

export const RULES_EMPTY_COPY =
  'A rule watches this plan and does the routine steps for you: moving, assigning, labelling and telling people about cards. Build your first one.';

export function RulesEmpty({ onNew }: { onNew: () => void }) {
  return (
    <div data-rules-empty="" className="px-5 py-6">
      <EmptyState icon={<BoltIcon size={24} />} title="No Rules Yet" description={RULES_EMPTY_COPY}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" size="sm" onClick={onNew}>
            <PlusIcon size={14} />
            New Rule
          </Button>
          <HelpArticleLink article="planAutomations" variant="button" label="How Rules Work" />
        </div>
      </EmptyState>
    </div>
  );
}
