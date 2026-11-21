'use client';

// The Rules list with no rules (liveplanner/docs/specs/026-plan/automations.md "The Automations screen": Empty): the bolt, No
// Rules Yet, what a rule does, New Rule, Describe a Rule and How Rules Work, then Start From a Template with the
// gallery below. The shared EmptyState, so it reads as every other empty surface in the editor.

import { Button, EmptyState, PlusIcon, SparkleIcon } from '@liveworkspace/ui';
import { BoltIcon } from './glyphs';
import { useAutomationsKit } from './kit-context';
import { TemplatesGallery } from './TemplatesGallery';

export function RulesEmpty({
  onNew,
  onTemplate,
  onDescribe,
}: {
  onNew: () => void;
  onTemplate: (id: string) => void;
  onDescribe: () => void;
}) {
  const kit = useAutomationsKit();
  return (
    <div data-rules-empty="" className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-6">
      <EmptyState
        icon={<BoltIcon size={24} />}
        title="No rules yet"
        description={kit.plumbing.words.empty}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" size="sm" onClick={onNew}>
            <PlusIcon size={14} />
            New Rule
          </Button>
          <Button variant="secondary" size="sm" onClick={onDescribe}>
            <SparkleIcon size={14} />
            Describe a Rule
          </Button>
          {kit.helpButton}
        </div>
      </EmptyState>
      <div className="mt-6">
        <TemplatesGallery onPick={onTemplate} />
      </div>
    </div>
  );
}
