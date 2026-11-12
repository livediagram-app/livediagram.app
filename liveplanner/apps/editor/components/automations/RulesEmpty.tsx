'use client';

// The Rules list with no rules (docs/specs/026-plan/automations.md "The Automations screen": Empty): the bolt, No
// Rules Yet, what a rule does, New Rule, Describe a Rule and How Rules Work, then Start From a Template with the
// gallery below. The shared EmptyState, so it reads as every other empty surface in the editor.

import type { AutomationTemplateId } from '@liveplanner/items';
import { Button, EmptyState, PlusIcon, SparkleIcon } from '@liveplanner/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { BoltIcon } from './automation-glyphs';
import { TemplatesGallery } from './TemplatesGallery';

export const RULES_EMPTY_COPY =
  'A rule watches this plan and does the routine steps for you: moving, assigning, labelling and telling people about cards. Start from one below or build your own.';

export function RulesEmpty({
  onNew,
  onTemplate,
  onDescribe,
}: {
  onNew: () => void;
  onTemplate: (id: AutomationTemplateId) => void;
  onDescribe: () => void;
}) {
  return (
    <div data-rules-empty="" className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-6">
      <EmptyState icon={<BoltIcon size={24} />} title="No Rules Yet" description={RULES_EMPTY_COPY}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" size="sm" onClick={onNew}>
            <PlusIcon size={14} />
            New Rule
          </Button>
          <Button variant="secondary" size="sm" onClick={onDescribe}>
            <SparkleIcon size={14} />
            Describe a Rule
          </Button>
          <HelpArticleLink article="planAutomations" variant="button" label="How Rules Work" />
        </div>
      </EmptyState>
      <div className="mt-6">
        <TemplatesGallery onPick={onTemplate} />
      </div>
    </div>
  );
}
